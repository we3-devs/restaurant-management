import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { customerApiClient } from "../customer-client"
import { toQueryString } from "../types"
import { queryKeys } from "../query-keys"
import type { Order, OrderItem } from "./use-orders"

export interface GuestOrderItemInput {
  foodId: number
  foodVariantId?: number
  quantity?: number
  note?: string
}

export interface SubmitGuestOrderInput {
  tableCode: string
  items: GuestOrderItemInput[]
}

// Unlike the staff order-detail page (which looks food names up from an
// already-loaded foods list), /orders/guest/mine embeds them directly — see
// OrdersService.findMineForCustomer.
export type GuestOrderItem = OrderItem & {
  food: { id: number; name: string } | null
  foodVariant: { id: number; name: string } | null
}

export type GuestOrder = Order & { items: GuestOrderItem[] }

/** Requires an OTP-verified customer session (not the anonymous guest-session type) — see CustomerJwtAuthGuard + requireVerifiedCustomerId on the backend. */
export function useSubmitGuestOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitGuestOrderInput) =>
      customerApiClient<GuestOrder>("/orders/guest", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guestOrders.mine(variables.tableCode) })
    },
  })
}

/** Cancels a guest's own order — backend rejects this once the order has moved past 'pending'/'accepted'. */
export function useCancelGuestOrder(tableCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: number) =>
      customerApiClient<GuestOrder>(`/orders/guest/${orderId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guestOrders.mine(tableCode) })
    },
  })
}

export function useMyGuestOrders(tableCode: string) {
  return useQuery({
    queryKey: queryKeys.guestOrders.mine(tableCode),
    queryFn: () => customerApiClient<GuestOrder[]>(`/orders/guest/mine${toQueryString({ tableCode })}`),
    enabled: !!tableCode,
    // Pushed live via guest-socket.ts (see useGuestOrderRealtime in
    // guest-order-tracker.tsx) — this interval is only the fallback for a
    // dropped/reconnecting socket, same role as the 30s poll in
    // use-kitchen-realtime.ts.
    refetchInterval: 60000,
  })
}
