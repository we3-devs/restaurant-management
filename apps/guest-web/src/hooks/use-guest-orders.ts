"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";
import { acquireGuestSocket, releaseGuestSocket } from "@/lib/guest-socket";
import { useGuestAuth } from "./use-guest-auth";
import { publicQueryKeys } from "@rms/api-client/query-keys";
import type { FoodStatusCount } from "@/lib/order-status";

export interface GuestOrderItem {
  id: number;
  foodId: number;
  foodVariantId: number | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isHeld: boolean;
  note: string | null;
  cancelReason: string | null;
  food: { name: string } | null;
  foodVariant: { name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestOrder {
  id: number;
  orderNumber: string;
  status: string;
  grandTotal: number;
  items: GuestOrderItem[];
  /**
   * Per food+variant kitchen progress, straight from
   * table_session_food_status_counts. Item rows carry the bill detail
   * (price, note, held); how far along the food is comes from here.
   */
  foodStatusCounts: FoodStatusCount[];
  createdAt: string;
}

/**
 * Shared by /order and the menu's tracker bar. Both mount the same query key,
 * so React Query serves one request and one cache to both rather than each
 * polling the backend on its own five-second timer.
 */
export function useGuestOrders(tableCode: string | null) {
  const { isAuthenticated } = useGuestAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => publicQueryKeys.guestOrders(tableCode!),
    [tableCode],
  );

  const query = useQuery<GuestOrder[]>({
    queryKey,
    queryFn: async () => {
      const res = await authFetch(
        `/orders/guest/mine?tableCode=${encodeURIComponent(tableCode!)}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      // This endpoint returns a bare array, not the paginated {data,meta} envelope.
      return Array.isArray(data) ? data : (data.data ?? []);
    },
    enabled: !!tableCode && isAuthenticated,
  });

  useEffect(() => {
    if (!tableCode || !isAuthenticated) return;
    // Shared, ref-counted connection — acquiring here just adds this
    // consumer's listener to whatever socket every other mounted guest
    // hook is already using, rather than opening (and ws-ticket-fetching
    // for) a brand new one on every page.
    const socket = acquireGuestSocket();
    const onOrderUpdated = () => {
      void queryClient.invalidateQueries({ queryKey });
    };
    socket.on("guest.order.updated", onOrderUpdated);
    return () => {
      socket.off("guest.order.updated", onOrderUpdated);
      releaseGuestSocket();
    };
  }, [tableCode, isAuthenticated, queryClient, queryKey]);

  return query;
}
