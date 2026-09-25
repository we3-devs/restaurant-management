"use client";

import { X } from "lucide-react";
import { useQuickOrderSession } from "@/hooks/use-quick-order-session";
import type { QrAccessCheckMode } from "@/hooks/use-table-session";
import { LocationPermissionHelp } from "./location-permission-help";

const ERROR_COPY: Record<string, string> = {
  geofence: "You don't appear to be at the restaurant — move closer and try again.",
  ip: "This network isn't recognized for this table — connect to the restaurant's Wi-Fi and try again.",
  other: "Couldn't verify you're at this table — try again.",
};

/**
 * Anonymous counterpart to GuestAuthSheet — no phone/OTP, just a tap that
 * (optionally) requests geolocation and confirms table access server-side.
 * Presented as a bottom sheet so it can gate either the /table landing page
 * or a mid-checkout prompt on /menu, matching GuestAuthSheet's usage.
 */
export function QuickOrderGate({
  tableCode,
  qrAccessCheckMode,
  onClose,
  onSuccess,
}: {
  tableCode: string;
  qrAccessCheckMode: QrAccessCheckMode | null;
  onClose?: () => void;
  onSuccess: () => void;
}) {
  const { join, isPending, error, errorKind } = useQuickOrderSession(tableCode, qrAccessCheckMode);

  const needsLocation =
    qrAccessCheckMode === "geofence" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both";

  async function handleContinue() {
    try {
      await join();
      onSuccess();
    } catch {
      // error state is surfaced from the hook below
    }
  }

  return (
    <>
      {onClose && (
        <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" />
      )}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">You&apos;re at Table {tableCode}</h2>
            <p className="truncate text-xs text-slate-500">
              {needsLocation ? "We'll check your location to confirm" : "We'll confirm your network"} — no sign-in needed.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          {error && errorKind === "permission_denied" && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <p className="font-medium">Location access is turned off for this site.</p>
              <p className="mt-1 mb-2">Turn it back on to confirm you're at the table:</p>
              <LocationPermissionHelp />
            </div>
          )}
          {error && errorKind !== "permission_denied" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {ERROR_COPY[errorKind ?? "other"]}
            </p>
          )}

          <button
            onClick={handleContinue}
            disabled={isPending}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Checking…" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
