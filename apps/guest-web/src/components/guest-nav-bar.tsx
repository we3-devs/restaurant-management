"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ShoppingCart, Users, UtensilsCrossed } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useCart } from "@/hooks/use-cart";
import { useGuestOrders } from "@/hooks/use-guest-orders";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useTableSession } from "@/hooks/use-table-session";

/**
 * Persistent bottom tab bar shared across guest pages. Every tab, including
 * Cart, is a plain page link — Cart always goes to the standalone /cart
 * page, never a slide-over. The cart itself comes from useCart's
 * sessionStorage-backed store, so it's identical regardless of which page
 * reads it.
 */
export function GuestNavBar() {
  const pathname = usePathname();
  const { tableCode } = useGuestSession();
  const { itemCount } = useCart(tableCode);
  const { isAuthenticated } = useGuestAuth();
  const { qrOrderingMode } = useTableSession(tableCode);
  const { data: guestOrders = [] } = useGuestOrders(tableCode);

  if (!tableCode) return null;

  const tableParam = encodeURIComponent(tableCode);
  const onMenu = pathname === "/menu";
  const onOrder = pathname === "/order";
  const onParty = pathname === "/table";
  const onCart = pathname === "/cart";
  // Quick-order guests are anonymous — there's no verified identity to
  // attach a party of companions to, so this tab only makes sense once
  // someone has actually signed in (login-mode outlets).
  const showParty = isAuthenticated && qrOrderingMode !== "quick_order";

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
      active ? "text-brand-600" : "text-slate-500"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-stretch">
        <Link href={`/menu?table=${tableParam}`} className={tabClass(onMenu)}>
          <UtensilsCrossed size={20} />
          Menu
        </Link>
        {showParty && (
          <Link href={`/table?table=${tableParam}`} className={tabClass(onParty)}>
            <Users size={20} />
            Party
          </Link>
        )}
        <Link href={`/cart?table=${tableParam}`} className={tabClass(onCart)}>
          <span className="relative">
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </span>
          Cart
        </Link>
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
      </div>
    </nav>
  );
}
