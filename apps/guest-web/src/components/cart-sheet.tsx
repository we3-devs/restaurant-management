"use client";

import { Check, Send, ShoppingCart, X } from "lucide-react";
import { useCheckout } from "@/hooks/use-checkout";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { LocationPermissionHelp } from "@/components/location-permission-help";

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

/**
 * Cart drawer used only on the /menu page — opened from the "View order"
 * bar that appears once something's in the cart, so reviewing/placing the
 * order doesn't require leaving the food grid. The nav bar's own Cart tab
 * always goes to the standalone /cart page instead (see GuestNavBar);
 * both share the same checkout logic via useCheckout.
 */
export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    cart,
    updateQuantity,
    total,
    isSubmitting,
    authIntent,
    setAuthIntent,
    showLocationHelp,
    setShowLocationHelp,
    handleSubmit,
    placeOrder,
  } = useCheckout();

  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px]" />
      )}

      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
          <h2 className="font-semibold text-slate-900">Cart</h2>
          <button onClick={onClose} aria-label="Close cart" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart size={32} className="text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">No items yet</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {cart.map((item) => (
                <li key={item.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.food.name}</p>
                      {item.variantLabel && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Check size={12} /> {item.variantLabel}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">{money(item.unitPrice * item.quantity)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-xs text-slate-500">Quantity</span>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-1">
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        aria-label={`Decrease ${item.food.name}`}
                        className="rounded-md px-2 py-0.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm font-bold tabular-nums text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        aria-label={`Increase ${item.food.name}`}
                        className="rounded-md px-2 py-0.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-semibold text-slate-900">{money(total)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={16} />
            {isSubmitting ? "Placing…" : "Place order"}
          </button>
        </div>
      </aside>

      {authIntent && (
        <GuestAuthSheet
          onClose={() => setAuthIntent(false)}
          onSuccess={() => {
            setAuthIntent(false);
            void placeOrder();
          }}
        />
      )}

      {showLocationHelp && (
        <>
          <div onClick={() => setShowLocationHelp(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5">
              <h2 className="font-semibold text-slate-900">Turn location back on</h2>
              <button
                onClick={() => setShowLocationHelp(false)}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-slate-600">
                This table requires confirming your location, but it's currently blocked for this site. Follow these
                steps, then come back and place your order again:
              </p>
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
                <LocationPermissionHelp />
              </div>
              <button
                onClick={() => setShowLocationHelp(false)}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
              >
                Got it
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
