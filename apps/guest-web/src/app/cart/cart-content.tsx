"use client";

import { Check, Send, ShoppingCart, X } from "lucide-react";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useCheckout } from "@/hooks/use-checkout";
import { useBranding } from "@/hooks/use-branding";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { GuestNavBar } from "@/components/guest-nav-bar";
import { LocationPermissionHelp } from "@/components/location-permission-help";

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

/**
 * Standalone Cart page — the nav bar's Cart tab always lands here, from any
 * guest page. Checkout logic (quick-order join, geofence re-check, place
 * order) lives in useCheckout, shared with nothing else right now but kept
 * separate so this component stays presentation-only.
 */
export default function CartContent() {
  const { tableCode, isReady } = useGuestSession();
  const branding = useBranding();
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

  if (!isReady) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!tableCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Invalid table code</p>
          <p className="mt-1 text-sm text-slate-500">Scan the QR code on your table to start ordering.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3.5">
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt="" className="size-9 shrink-0 rounded-lg object-contain" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">Cart</h1>
            <p className="truncate text-xs text-slate-500">Table {tableCode}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-40">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingCart size={32} className="text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No items yet</p>
            <a
              href={`/menu?table=${tableCode}`}
              className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
            >
              Browse menu
            </a>
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {cart.map((item) => (
                <li key={item.key} className="rounded-xl border border-slate-200 bg-white p-3">
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

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-lg font-semibold text-slate-900">{money(total)}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={cart.length === 0 || isSubmitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={16} />
                {isSubmitting ? "Placing…" : "Place order"}
              </button>
            </section>
          </>
        )}
      </main>

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

      <GuestNavBar />
    </div>
  );
}
