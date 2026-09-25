"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useGuestAuth } from "@/hooks/use-guest-auth";
import { useTableSession } from "@/hooks/use-table-session";
import { useQuickOrderSession } from "@/hooks/use-quick-order-session";
import { authFetch, readError } from "@/lib/api";

/**
 * Cart contents + full checkout flow (quick-order join, geofence re-check,
 * place order), used by the standalone /cart page.
 */
export function useCheckout() {
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

  return {
    tableCode,
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
  };
}
