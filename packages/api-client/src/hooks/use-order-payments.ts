import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { patchDiningTableStatus } from "./use-dining-tables"
import { findCachedDiningTableId } from "./use-table-sessions"
import type { Order } from "./use-orders"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"
import type { CreateOrderPaymentInput } from "@rms/validators/orders"
import { operationalMutationHeaders, type OperationalMutationOptions } from "../operational-mutation"

export interface CreateTableSessionPaymentInput {
  method: (typeof ORDER_PAYMENT_METHODS)[number]
  amount: number
  note?: string
  /** Required when method="credit" — the customer whose tab is charged. */
  customerId?: number
}

export interface OrderPayment {
  id: number
  outletId: number
  orderId: number
  customerId: number | null
  receivedBy: number | null
  paymentNumber: string
  type: string
  method: string
  provider: string | null
  transactionReference: string | null
  amount: number
  status: string
  paidAt: string | null
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

export function useCreateOrderPayment(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderPaymentInput) =>
      apiClient<OrderPayment>(`/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.payments(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

/** One combined payment across every open order on a table session — see OrderPaymentsService#payForTableSession. */
export function useCreateTableSessionPayment(tableSessionId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTableSessionPaymentInput) =>
      apiClient<{ payments: OrderPayment[]; orders: Order[] }>(`/table-sessions/${tableSessionId}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: operationalMutationHeaders(options.closedHoursOverride),
      }),
    onSuccess: () => {
      // Covers every nested key (lists/detail/payments) — each individual
      // order's totals and this order list all changed together.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

/** Completes every open order on a table session at once, once every one of them is fully paid. */
export function useCompleteAllForTableSession(tableSessionId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<Order[]>(`/orders/table-sessions/${tableSessionId}/complete-all`, { method: "POST", headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      // Completing every open order on the session ends it server-side
      // (OrdersService#freeTableForCompletedOrder), which frees the table —
      // so paint it available now instead of leaving it red until the floor
      // board's GET lands.
      const diningTableId = findCachedDiningTableId(queryClient, tableSessionId)
      if (diningTableId !== null) patchDiningTableStatus(queryClient, diningTableId, "available")
      // refetchType "all": the floor board is unmounted while staff are on
      // this checkout screen, so an active-only invalidation would defer the
      // refetch until they navigate back to it.
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists(), refetchType: "all" })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists(), refetchType: "all" })
    },
  })
}
