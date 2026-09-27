import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey, type UseMutationOptions } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { patchDiningTableStatus } from "./use-dining-tables"
import { findCachedDiningTableId } from "./use-table-sessions"
import type { Order } from "./use-orders"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"
import type { CreateOrderPaymentInput } from "@rms/validators/orders"
import { calculatePaymentTotals } from "@rms/validators/payment-totals"
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
  idempotencyKey: string | null
  amount: number
  status: string
  paidAt: string | null
  note: string | null
  createdAt: string
}

// ── Optimistic payment totals ────────────────────────────────────────────
// The checkout summaries (paid/due, and the Complete buttons they gate) read
// the cached payment ledger and orders. Waiting for the POST and then a
// refetch left them on the old totals for two round trips, so a sent payment
// is applied to the cache immediately and the server's copies replace it
// when they land. The server records every new payment as "completed", so the
// placeholder matches what it will return.

type CacheSnapshot = Array<[QueryKey, unknown]>

let nextPlaceholderId = -1

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Cancels in-flight fetches for these orders' caches (so they can't overwrite the optimistic values) and returns their current contents for rollback. */
async function snapshotOrderCaches(queryClient: QueryClient, orderIds: number[]): Promise<CacheSnapshot> {
  const keys: QueryKey[] = [
    queryKeys.orders.lists(),
    ...orderIds.flatMap((id) => [queryKeys.orders.detail(id), queryKeys.orders.payments(id)]),
  ]
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })))
  return keys.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }))
}

function restoreOrderCaches(queryClient: QueryClient, snapshot: CacheSnapshot): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data)
}

/** Replaces the given orders in the detail cache and in every cached order list. */
function writeOrders(queryClient: QueryClient, orders: Order[]): void {
  const byId = new Map(orders.map((order) => [order.id, order]))
  for (const order of orders) {
    queryClient.setQueryData<Order>(queryKeys.orders.detail(order.id), (old) => (old ? { ...old, ...order } : old))
  }
  queryClient.setQueriesData<PaginatedResponse<Order>>({ queryKey: queryKeys.orders.lists() }, (old) =>
    old ? { ...old, data: old.data.map((order) => (byId.has(order.id) ? { ...order, ...byId.get(order.id) } : order)) } : old,
  )
}

/** An order's totals once `amount` more has been paid (or refunded). */
function orderWithPayment(order: Order, amount: number, type: string = "payment"): Order {
  const paidAmount = round2(order.paidAmount + (type === "refund" ? -amount : amount))
  const dueAmount = Math.max(round2(order.grandTotal - paidAmount), 0)
  const paymentStatus = paidAmount <= 0 ? "unpaid" : paidAmount >= order.grandTotal ? "paid" : "partial"
  return { ...order, paidAmount, dueAmount, paymentStatus }
}

/** Every cached order on a table session, deduplicated across the list caches. */
function cachedTableSessionOrders(queryClient: QueryClient, tableSessionId: number): Order[] {
  const byId = new Map<number, Order>()
  for (const [, list] of queryClient.getQueriesData<PaginatedResponse<Order>>({ queryKey: queryKeys.orders.lists() })) {
    for (const order of list?.data ?? []) {
      if (order.tableSessionId === tableSessionId) byId.set(order.id, order)
    }
  }
  return [...byId.values()]
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
  return useMutation(createOrderPaymentMutation(useQueryClient(), orderId, options))
}

/** useCreateOrderPayment's mutation options — a plain function so the optimistic cache handling can be exercised without React. */
export function createOrderPaymentMutation(
  queryClient: QueryClient,
  orderId: number,
  options: OperationalMutationOptions = {},
): UseMutationOptions<OrderPayment, Error, CreateOrderPaymentInput, { snapshot: CacheSnapshot; placeholderId: number }> {
  const ledgerKey = queryKeys.orders.payments(orderId)
  return {
    mutationFn: (input: CreateOrderPaymentInput) =>
      apiClient<OrderPayment>(`/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    // Show the sent payment in the summary right away (see the note above
    // snapshotOrderCaches).
    onMutate: async (input) => {
      const snapshot = await snapshotOrderCaches(queryClient, [orderId])
      const now = new Date().toISOString()
      const placeholder: OrderPayment = {
        id: nextPlaceholderId--,
        outletId: 0,
        orderId,
        customerId: input.customerId ?? null,
        receivedBy: null,
        paymentNumber: "",
        type: input.type,
        method: input.method,
        provider: null,
        transactionReference: null,
        idempotencyKey: input.idempotencyKey ?? null,
        amount: input.amount,
        status: "completed",
        paidAt: now,
        note: input.note ?? null,
        createdAt: now,
      }
      const ledger = queryClient.getQueryData<PaginatedResponse<OrderPayment>>(ledgerKey)
      if (ledger) {
        queryClient.setQueryData<PaginatedResponse<OrderPayment>>(ledgerKey, {
          ...ledger,
          data: [...ledger.data, placeholder],
          meta: { ...ledger.meta, total: ledger.meta.total + 1 },
        })
      }
      const order = queryClient.getQueryData<Order>(queryKeys.orders.detail(orderId))
      if (order) {
        // Straight from the ledger when it's loaded, the same way the
        // checkout screens compute it; otherwise from the order's own totals.
        const totals = ledger ? calculatePaymentTotals(order.grandTotal, [...ledger.data, placeholder]) : null
        writeOrders(queryClient, [
          totals
            ? { ...order, paidAmount: totals.paidAmount, dueAmount: totals.dueAmount, paymentStatus: totals.paymentStatus }
            : orderWithPayment(order, input.amount, input.type),
        ])
      }
      return { snapshot, placeholderId: placeholder.id }
    },
    onError: (_error, _input, context) => {
      if (context) restoreOrderCaches(queryClient, context.snapshot)
    },
    onSuccess: (payment, _input, context) => {
      queryClient.setQueryData<PaginatedResponse<OrderPayment>>(ledgerKey, (old) =>
        old ? { ...old, data: old.data.map((entry) => (entry.id === context?.placeholderId ? payment : entry)) } : old,
      )
    },
    onSettled: () => {
      // Reconcile with the server in the background.
      queryClient.invalidateQueries({ queryKey: ledgerKey })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  }
}

/** One combined payment across every open order on a table session — see OrderPaymentsService#payForTableSession. */
export function useCreateTableSessionPayment(tableSessionId: number, options: OperationalMutationOptions = {}) {
  return useMutation(createTableSessionPaymentMutation(useQueryClient(), tableSessionId, options))
}

/** useCreateTableSessionPayment's mutation options — a plain function so the optimistic cache handling can be exercised without React. */
export function createTableSessionPaymentMutation(
  queryClient: QueryClient,
  tableSessionId: number,
  options: OperationalMutationOptions = {},
): UseMutationOptions<{ payments: OrderPayment[]; orders: Order[] }, Error, CreateTableSessionPaymentInput, { snapshot: CacheSnapshot }> {
  return {
    mutationFn: (input: CreateTableSessionPaymentInput) =>
      apiClient<{ payments: OrderPayment[]; orders: Order[] }>(`/table-sessions/${tableSessionId}/payments`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: operationalMutationHeaders(options.closedHoursOverride),
      }),
    // Spread the amount over the table's open orders exactly as
    // OrderPaymentsService#payForTableSession does — oldest first, skipping
    // completed or fully paid ones — so the table bill updates the moment the
    // payment is sent.
    onMutate: async (input) => {
      const openOrders = cachedTableSessionOrders(queryClient, tableSessionId)
        .filter((order) => order.status !== "completed" && order.status !== "cancelled" && order.dueAmount > 0)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const snapshot = await snapshotOrderCaches(queryClient, openOrders.map((order) => order.id))
      let remaining = input.amount
      const paid: Order[] = []
      for (const order of openOrders) {
        if (remaining <= 0) break
        const portion = Math.min(remaining, order.dueAmount)
        paid.push(orderWithPayment(order, portion))
        remaining = round2(remaining - portion)
      }
      writeOrders(queryClient, paid)
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      if (context) restoreOrderCaches(queryClient, context.snapshot)
    },
    // The response already carries every order's updated totals — use them
    // straight away rather than waiting on the refetch below.
    onSuccess: ({ orders }) => writeOrders(queryClient, orders),
    onSettled: () => {
      // Covers every nested key (lists/detail/payments) — each individual
      // order's totals and this order list all changed together.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  }
}

/** Completes every open order on a table session at once, once every one of them is fully paid. */
export function useCompleteAllForTableSession(tableSessionId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<Order[]>(`/orders/table-sessions/${tableSessionId}/complete-all`, { method: "POST", headers: operationalMutationHeaders(options.closedHoursOverride) }),
    // Completing every open order on the session ends it server-side
    // (OrdersService#freeTableForCompletedOrder), which frees the table — so
    // paint it available the instant staff tap the action instead of leaving
    // it red until the round trip lands, and roll it back to 'occupied' if
    // the request fails.
    onMutate: () => {
      const diningTableId = findCachedDiningTableId(queryClient, tableSessionId)
      if (diningTableId !== null) patchDiningTableStatus(queryClient, diningTableId, "available")
      return { diningTableId }
    },
    onError: (_err, _vars, context) => {
      if (context?.diningTableId != null) patchDiningTableStatus(queryClient, context.diningTableId, "occupied")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      // refetchType "all": the floor board is unmounted while staff are on
      // this checkout screen, so an active-only invalidation would defer the
      // refetch until they navigate back to it.
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists(), refetchType: "all" })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists(), refetchType: "all" })
    },
  })
}
