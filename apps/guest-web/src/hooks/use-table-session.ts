"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, readError } from "@/lib/api";
import { useGuestAuth } from "./use-guest-auth";

export interface TablePartyMember {
  id: number;
  name: string;
  phone: string | null;
  loyaltyTier: string | null;
}

export interface TableSession {
  id: number;
  outletName: string;
  diningTableName: string;
  guestCount: number;
  customers: TablePartyMember[];
}

export function useTableSession(tableCode: string | null) {
  const { isAuthenticated } = useGuestAuth();
  const qc = useQueryClient();
  const key = ["table-session", tableCode];
  const [joined, setJoined] = useState(false);
  const joiningRef = useRef(false);

  // One write on entry: attach this verified guest to the table's session
  // (opening one if needed). Everything after is read-only polling.
  const join = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/table-sessions/guest/join`, {
        method: "POST",
        body: JSON.stringify({ tableCode }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to join table"));
      return res.json() as Promise<TableSession>;
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setJoined(true);
    },
  });

  useEffect(() => {
    if (!tableCode || !isAuthenticated || joined || joiningRef.current) return;
    joiningRef.current = true;
    join.mutate(undefined, { onSettled: () => (joiningRef.current = false) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableCode, isAuthenticated, joined]);

  const query = useQuery<TableSession | null>({
    queryKey: key,
    queryFn: async () => {
      const res = await authFetch(
        `/table-sessions/guest/current?tableCode=${encodeURIComponent(tableCode!)}`
      );
      if (!res.ok) throw new Error(await readError(res, "Failed to load table"));
      return res.json();
    },
    enabled: !!tableCode && isAuthenticated && joined,
    refetchInterval: 15000,
  });

  const addCompanion = useMutation({
    mutationFn: async (input: { name: string; phone: string }) => {
      const res = await authFetch(`/table-sessions/guest/companions`, {
        method: "POST",
        body: JSON.stringify({ tableCode, ...input }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to add guest"));
      return res.json();
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  const removeCompanion = useMutation({
    mutationFn: async (companionId: number) => {
      const res = await authFetch(
        `/table-sessions/guest/companions/${companionId}?tableCode=${encodeURIComponent(
          tableCode!
        )}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await readError(res, "Failed to remove guest"));
      return res.json();
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  return {
    session: query.data ?? null,
    members: query.data?.customers ?? [],
    isLoading: join.isPending || (joined && query.isLoading),
    error: (join.error ?? query.error) as Error | null,
    addCompanion,
    removeCompanion,
  };
}
