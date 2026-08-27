"use client";

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

  const query = useQuery<TableSession | null>({
    queryKey: key,
    queryFn: async () => {
      const res = await authFetch(
        `/table-sessions/guest/join`,
        {
          method: "POST",
          body: JSON.stringify({ tableCode }),
        }
      );
      if (!res.ok) throw new Error(await readError(res, "Failed to join table"));
      return res.json();
    },
    enabled: !!tableCode && isAuthenticated,
    refetchInterval: 10000,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    session: query.data ?? null,
    members: query.data?.customers ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    addCompanion,
    removeCompanion,
  };
}
