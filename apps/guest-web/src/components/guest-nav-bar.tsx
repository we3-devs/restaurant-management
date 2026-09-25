"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useCart } from "@/hooks/use-cart";
import { useGuestOrders } from "@/hooks/use-guest-orders";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { CartSheet } from "@/components/cart-sheet";

/**
 * Persistent bottom tab bar shared by /menu and /order — Menu/Ordered
 * navigate between pages, Cart opens the same CartSheet from either one
 * (cart contents come from sessionStorage via useCart, not page-local
 * state, so it's identical no matter which tab opened it).
 */
export function GuestNavBar() {
  const pathname = usePathname();
  const { tableCode } = useGuestSession();
  const { itemCount } = useCart(tableCode);
  const { isAuthenticated } = useGuestAuth();
  const { data: guestOrders = [] } = useGuestOrders(tableCode);
  const [cartOpen, setCartOpen] = useState(false);

  if (!tableCode) return null;

  const tableParam = encodeURIComponent(tableCode);
  const onMenu = pathname === "/menu";
  const onOrder = pathname === "/order";

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
      active ? "text-brand-600" : "text-slate-500"
    }`;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-stretch">
          <Link href={`/menu?table=${tableParam}`} className={tabClass(onMenu)}>
            <UtensilsCrossed size={20} />
            Menu
          </Link>
          <button onClick={() => setCartOpen(true)} className={tabClass(cartOpen)}>
            <span className="relative">
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-semibold text-white">
                  {itemCount}
                </span>
              )}
            </span>
            Cart
          </button>
          {isAuthenticated && (
            <Link href={`/order?table=${tableParam}`} className={tabClass(onOrder)}>
              <span className="relative">
                <ClipboardList size={20} />
                {guestOrders.length > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-semibold text-white">
                    {guestOrders.length}
                  </span>
                )}
              </span>
              Ordered
            </Link>
          )}
        </div>
      </nav>

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
