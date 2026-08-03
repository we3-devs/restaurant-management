import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { Order } from "@/hooks/use-orders"
import { ORDER_PAYMENT_METHODS } from "@/lib/validators/orders"
import type { CreateOrderPaymentInput } from "@/lib/validators/orders"

export interface CreateTableSessionPaymentInput {
  method: (typeof ORDER_PAYMENT_METHODS)[number]
  amount: number
  note?: string
}

export interface OrderPayment {
  id: number
  outletId: number
  orderId: number
  paymentNumber: string
  type: string
  method: string
  amount: number
  status: string
  note: string | null
  createdAt: string
}

export function useOrderPayments(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.payments(orderId),
    queryFn: () =>
      apiClient<PaginatedResponse<OrderPayment>>(`/order-payments${toQueryString({ orderId, limit: 100 })}`),
    enabled: orderId > 0,
  })
}

export function useCreateOrderPayment(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderPaymentInput) =>
      apiClient<OrderPayment>(`/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.payments(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

/** One combined payment across every open order on a table session — see OrderPaymentsService#payForTableSession. */
export function useCreateTableSessionPayment(tableSessionId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTableSessionPaymentInput) =>
      apiClient<{ payments: OrderPayment[]; orders: Order[] }>(`/table-sessions/${tableSessionId}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Covers every nested key (lists/detail/payments) — each individual
      // order's totals and this order list all changed together.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

/** Completes every open order on a table session at once, once every one of them is fully paid. */
export function useCompleteAllForTableSession(tableSessionId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<Order[]>(`/orders/table-sessions/${tableSessionId}/complete-all`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}
