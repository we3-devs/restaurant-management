"use client";

import type { Food } from "@rms/api-client/hooks/use-foods";
import type { FoodVariant } from "@rms/api-client/hooks/use-food-variants";

/**
 * Cart is sessionStorage-backed (not just React state) so it survives
 * navigating between /menu and /order — the bottom nav bar's Cart tab needs
 * to show the same cart regardless of which page it's opened from. Keyed by
 * tableCode, matching useGuestSession's own table lock (per-tab, cleared
 * when the tab closes — a fresh QR scan starts a fresh cart).
 */
export interface CartItem {
  key: string;
  food: Food;
  variant: FoodVariant | null;
  /** "Veg · Full" for a nested pick, "Full" for a flat one. */
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
}

export const cartItemKey = (foodId: number, variantId?: number | null) => `${foodId}:${variantId ?? 0}`;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const listener of listeners) listener();
}
export function subscribeCart(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Cached per tableCode so useSyncExternalStore gets a stable reference
// between renders (re-parsing sessionStorage on every call would otherwise
// look like a new snapshot every time and warn/loop).
let cachedTableCode: string | null = null;
let cachedItems: CartItem[] = [];

function storageKey(tableCode: string): string {
  return `guest_cart:${tableCode}`;
}

function readFromStorage(tableCode: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(tableCode));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function getCartSnapshot(tableCode: string | null): CartItem[] {
  if (!tableCode) return [];
  if (cachedTableCode !== tableCode) {
    cachedTableCode = tableCode;
    cachedItems = readFromStorage(tableCode);
  }
  return cachedItems;
}

export function setCartItems(tableCode: string | null, items: CartItem[]) {
  if (!tableCode || typeof window === "undefined") return;
  cachedTableCode = tableCode;
  cachedItems = items;
  sessionStorage.setItem(storageKey(tableCode), JSON.stringify(items));
  notify();
}
