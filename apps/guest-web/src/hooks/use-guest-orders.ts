"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { useGuestAuth } from "./use-guest-auth";

export interface GuestOrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  isHeld: boolean;
  note: string | null;
  cancelReason: string | null;
  food: { name: string } | null;
  foodVariant: { name: string } | null;
}

export interface GuestOrder {
  id: number;
  orderNumber: string;
  status: string;
  grandTotal: number;
  items: GuestOrderItem[];
  createdAt: string;
}

/**
 * Shared by /order and the menu's tracker bar. Both mount the same query key,
 * so React Query serves one request and one cache to both rather than each
 * polling the backend on its own five-second timer.
 */
export function useGuestOrders(tableCode: string | null) {
  const { isAuthenticated } = useGuestAuth();

  return useQuery<GuestOrder[]>({
    queryKey: ["orders", tableCode],
    queryFn: async () => {
      const res = await authFetch(
        `/orders/guest/mine?tableCode=${encodeURIComponent(tableCode!)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      // This endpoint returns a bare array, not the paginated {data,meta} envelope.
      return Array.isArray(data) ? data : (data.data ?? []);
    },
    // Keeps running whatever the status — a served order can still be reopened
    // or amended by staff, and the guest should see that.
    refetchInterval: 5000,
    // The endpoint runs requireVerifiedCustomerId — without a token it is a
    // guaranteed 401, so don't poll it every 5s for nothing.
    enabled: !!tableCode && isAuthenticated,
  });
}
