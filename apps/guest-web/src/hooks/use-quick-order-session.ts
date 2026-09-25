"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { API_URL, readError } from "@/lib/api";
import { setSession } from "@/lib/guest-auth";
import type { GuestLocation, QrAccessCheckMode } from "./use-table-session";

type JoinError = "geofence" | "ip" | "permission_denied" | "other";

/**
 * Anonymous counterpart to useTableSession's join flow — for outlets in
 * quick_order mode, skips OTP entirely and joins via
 * POST table-sessions/quick-order/join, gated server-side by IP/geofence.
 *
 * location/locationDenied come from useTableSession, which requests them
 * once in parallel with the page loading — this never re-requests
 * geolocation itself, it just reads whatever that single attempt produced.
 */
export function useQuickOrderSession(
  tableCode: string | null,
  qrAccessCheckMode: QrAccessCheckMode | null,
  location: GuestLocation | null,
  locationDenied: boolean,
) {
  const [errorKind, setErrorKind] = useState<JoinError | null>(null);

  const join = useMutation({
    mutationFn: async () => {
      setErrorKind(null);
      const needsLocation =
        qrAccessCheckMode === "geofence" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both";

      if (needsLocation && !location && locationDenied && qrAccessCheckMode !== "either") {
        // "either" can still fall through to an IP-only pass server-side;
        // ip/geofence/both modes need the coordinates to have any chance.
        setErrorKind("permission_denied");
        throw new Error("Location permission is required");
      }

      const res = await fetch(`${API_URL}/table-sessions/quick-order/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode, latitude: location?.latitude, longitude: location?.longitude }),
      });

      if (!res.ok) {
        if (res.status === 403) setErrorKind(qrAccessCheckMode === "ip" ? "ip" : "geofence");
        throw new Error(await readError(res, "Couldn't verify you're at this table"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSession(data.accessToken, data.refreshToken, "Guest");
    },
  });

  return {
    join: () => join.mutateAsync(),
    isPending: join.isPending,
    error: join.error as Error | null,
    errorKind,
  };
}
