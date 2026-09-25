"use client";

import { useCallback, useSyncExternalStore } from "react";
import toast from "react-hot-toast";
import type { Food } from "@rms/api-client/hooks/use-foods";
import type { FoodVariant } from "@rms/api-client/hooks/use-food-variants";
import { cartItemKey, getCartSnapshot, setCartItems, subscribeCart, type CartItem } from "@/lib/guest-cart";

export type { CartItem } from "@/lib/guest-cart";

/**
 * sessionStorage-backed cart, shared by the /menu food grid, the bottom nav
 * bar's Cart tab, and the /order page — see lib/guest-cart.ts for why it's
 * not just useState (it needs to read the same cart regardless of which
 * page opened it).
 */
export function useCart(tableCode: string | null) {
  const cart = useSyncExternalStore(
    subscribeCart,
    () => getCartSnapshot(tableCode),
    () => [] as CartItem[],
  );

  const addItem = useCallback(
    (food: Food, variant: FoodVariant | null, variantLabel: string | null) => {
      if (variant?.inventoryAvailable === false) {
        toast.error(`${food.name}${variantLabel ? ` · ${variantLabel}` : ""} is out of stock`);
        return;
      }
      const key = cartItemKey(food.id, variant?.id);
      const unitPrice = variant?.price ?? 0;
      const current = getCartSnapshot(tableCode);
      const existing = current.find((i) => i.key === key);
      const next = existing
        ? current.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i))
        : [...current, { key, food, variant, variantLabel, unitPrice, quantity: 1 }];
      setCartItems(tableCode, next);
      toast.success(variantLabel ? `${food.name} · ${variantLabel}` : food.name);
    },
    [tableCode],
  );

  const updateQuantity = useCallback(
    (key: string, quantity: number) => {
      const current = getCartSnapshot(tableCode);
      const next =
        quantity <= 0
          ? current.filter((i) => i.key !== key)
          : current.map((i) => (i.key === key ? { ...i, quantity } : i));
      setCartItems(tableCode, next);
    },
    [tableCode],
  );

  const clearCart = useCallback(() => setCartItems(tableCode, []), [tableCode]);

  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return { cart, addItem, updateQuantity, clearCart, total, itemCount };
}
