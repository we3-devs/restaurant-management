import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { customerApiClient } from "@/lib/api/customer-client"
import { toQueryString } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { Order, OrderItem } from "@/hooks/use-orders"

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

export type GuestOrder = Order & { items: OrderItem[] }

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
    // No websocket channel for guest sessions yet (see kds-socket.ts — ticket
    // exchange is staff-only) — short polling keeps order status "close to"
    // realtime for guest tracking without expanding that auth surface here.
    refetchInterval: 7000,
  })
}
