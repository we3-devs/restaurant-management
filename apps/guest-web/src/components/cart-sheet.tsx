"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, Send, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useTableSession } from "@/hooks/use-table-session";
import { useQuickOrderSession } from "@/hooks/use-quick-order-session";
import { GuestAuthSheet } from "@/components/guest-auth-sheet";
import { LocationPermissionHelp } from "@/components/location-permission-help";
import { authFetch, readError } from "@/lib/api";

const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

/**
 * Self-contained cart + checkout, mountable from any guest page (currently
 * /menu and /order via the shared bottom nav bar's Cart tab). Cart contents
 * come from useCart's sessionStorage-backed store, not page-local state, and
 * every hook it needs (table session, auth, quick-order join) is callable
 * from anywhere — so this never depends on which page opened it.
 */
export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tableCode } = useGuestSession();
  const { cart, updateQuantity, clearCart, total } = useCart(tableCode);
  const { isAuthenticated } = useGuestAuth();
  const { qrOrderingMode, qrAccessCheckMode, location, locationDenied } = useTableSession(tableCode);
  const quickOrderSession = useQuickOrderSession(tableCode, qrAccessCheckMode, location, locationDenied);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authIntent, setAuthIntent] = useState(false);
  const [showLocationHelp, setShowLocationHelp] = useState(false);

  const placeOrder = async () => {
    setIsSubmitting(true);
    try {
      // location comes from useTableSession, requested once in parallel with
      // the page loading — no fresh geolocation call happens here. A
      // "geofence"/"both" outlet (where location isn't just one of two
      // alternatives) with no reading and a known denial stops before
      // hitting the network at all, instead of submitting with no
      // coordinates and getting the backend's generic rejection.
      const needsGeofence =
        qrOrderingMode === "quick_order" &&
        (qrAccessCheckMode === "geofence" || qrAccessCheckMode === "either" || qrAccessCheckMode === "both");
      if (needsGeofence && !location && locationDenied && qrAccessCheckMode !== "either") {
        setShowLocationHelp(true);
        setIsSubmitting(false);
        return;
      }

      const res = await authFetch("/orders/guest", {
        method: "POST",
        body: JSON.stringify({
          tableCode,
          items: cart.map((i) => ({
            foodId: i.food.id,
            ...(i.variant ? { foodVariantId: i.variant.id } : {}),
            quantity: i.quantity,
          })),
          ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
        }),
      });

      if (!res.ok) throw new Error(await readError(res, "Failed to place order"));

      toast.success("Order placed!");
      clearCart();
      onClose();
      setTimeout(() => {
        window.location.href = `/order?table=${tableCode}`;
      }, 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error("Add items first");
      return;
    }
    // Browsing stays open to everyone; identity is only required at the point
    // it actually matters, which is also where the backend demands it.
    if (!isAuthenticated) {
      if (qrOrderingMode === "quick_order") {
        // No OTP, and location was already fetched on page load — join
        // happens silently in the background instead of an extra "Continue"
        // tap that would just be confirming something we already have.
        void (async () => {
          setIsSubmitting(true);
          try {
            await quickOrderSession.join();
            await placeOrder();
          } catch (err) {
            if (err instanceof Error && err.message === "Location permission is required") {
              setShowLocationHelp(true);
            } else {
              toast.error(err instanceof Error ? err.message : "Couldn't verify you're at this table");
            }
            setIsSubmitting(false);
          }
        })();
        return;
      }
      setAuthIntent(true);
      return;
    }
    void placeOrder();
  };

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
