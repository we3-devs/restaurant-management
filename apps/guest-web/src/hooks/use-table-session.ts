"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch, readError } from "@/lib/api";
import { useGuestAuth } from "./use-guest-auth";

export type QrOrderingMode = "login" | "quick_order";
export type QrAccessCheckMode = "ip" | "geofence" | "either" | "both";

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
  startedAt: string | null;
  customers: TablePartyMember[];
}

export function formatTableSessionTime(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { hour: "2-digit", minute: "2-digit" });
}

export function useTableSession(tableCode: string | null) {
  const { token } = useGuestAuth();
  const qc = useQueryClient();
  // Joining is tied to the authenticated customer, not just the table. This
  // matters when somebody signs out and another customer signs in on the same
  // browser while staying on the table page.
  const key = ["table-session", tableCode, token];
  const [joinedToken, setJoinedToken] = useState<string | null>(null);
  const [qrOrderingMode, setQrOrderingMode] = useState<QrOrderingMode | null>(null);
  const [qrAccessCheckMode, setQrAccessCheckMode] = useState<QrAccessCheckMode | null>(null);
  const joiningRef = useRef(false);
  const scannedRef = useRef(false);
  const joined = !!token && joinedToken === token;

  // One write on entry: attach this verified guest to the table's session
  // (opening one if needed). Everything after is read-only polling. Only
  // used for login-mode outlets — quick_order outlets join anonymously via
  // useQuickOrderSession instead, since this endpoint requires OTP-verified
  // identity.
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
      setJoinedToken(token);
    },
  });

  // Occupy the table the moment the QR is scanned, before any sign-in — the
  // join below needs a verified customer, which a diner doesn't have until
  // checkout, so gating occupancy on it left tables reading 'available' to
  // staff while people were sitting at them. Also reports the outlet's QR
  // ordering mode so the caller knows whether to show the OTP sheet or the
  // no-login quick-order gate.
  useEffect(() => {
    if (!tableCode || scannedRef.current) return;
    scannedRef.current = true;
    void authFetch(`/table-sessions/guest/scan`, {
      method: "POST",
      body: JSON.stringify({ tableCode }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.qrOrderingMode) setQrOrderingMode(data.qrOrderingMode);
        if (data?.qrAccessCheckMode) setQrAccessCheckMode(data.qrAccessCheckMode);
      })
      .catch(() => undefined);
  }, [tableCode]);

  useEffect(() => {
    if (!tableCode || !token || joined || joiningRef.current) return;
    // quick_order outlets join through useQuickOrderSession's own endpoint —
    // calling this one with a guest-typed token would just 401.
    if (qrOrderingMode === "quick_order") return;
    joiningRef.current = true;
    join.mutate(undefined, { onSettled: () => (joiningRef.current = false) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableCode, token, joined, qrOrderingMode]);

  const query = useQuery<TableSession | null>({
    queryKey: key,
    queryFn: async () => {
      const res = await authFetch(
        `/table-sessions/guest/current?tableCode=${encodeURIComponent(tableCode!)}`
      );
      if (!res.ok) throw new Error(await readError(res, "Failed to load table"));
      return res.json();
    },
    enabled: !!tableCode && !!token && joined,
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
    qrOrderingMode,
    qrAccessCheckMode,
  };
}
