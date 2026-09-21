"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { API_URL, readError } from "@/lib/api";
import { setSession } from "@/lib/guest-auth";
import type { QrAccessCheckMode } from "./use-table-session";

type JoinError = "geofence" | "ip" | "permission_denied" | "other";

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation isn't available in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
    });
  });
}

/**
 * Anonymous counterpart to useTableSession's join flow — for outlets in
 * quick_order mode, skips OTP entirely and joins via
 * POST table-sessions/quick-order/join, gated server-side by IP/geofence.
 */
export function useQuickOrderSession(tableCode: string | null, qrAccessCheckMode: QrAccessCheckMode | null) {
  const [errorKind, setErrorKind] = useState<JoinError | null>(null);

  const join = useMutation({
    mutationFn: async () => {
      setErrorKind(null);
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (qrAccessCheckMode === "geofence" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both") {
        try {
          const position = await getCurrentPosition();
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (err) {
          if (qrAccessCheckMode !== "either") {
            // "either" can still fall through to an IP-only pass server-side;
            // ip/geofence/both modes need the coordinates to have any chance.
            setErrorKind(
              err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED
                ? "permission_denied"
                : "geofence",
            );
            throw err;
          }
        }
      }

      const res = await fetch(`${API_URL}/table-sessions/quick-order/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode, latitude, longitude }),
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
