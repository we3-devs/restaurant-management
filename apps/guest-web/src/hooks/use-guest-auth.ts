"use client";

import { useSyncExternalStore } from "react";
import {
  clearSession,
  getCustomerName,
  getToken,
  subscribe,
} from "@/lib/guest-auth";

/**
 * Both snapshots return primitives straight out of sessionStorage, so React's
 * identity check stays stable between renders. The server snapshot is null —
 * these pages are force-dynamic, and a signed-out first paint is correct.
 */
export function useGuestAuth() {
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  const name = useSyncExternalStore(subscribe, getCustomerName, () => null);

  return {
    token,
    name,
    isAuthenticated: !!token,
    signOut: clearSession,
  };
}
