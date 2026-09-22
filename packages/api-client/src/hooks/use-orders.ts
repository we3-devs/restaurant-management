import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queuableApiClient } from "../offline/queuable-api-client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { applyOrderReadyItemsServed, applyOrderTicketItemServed } from "../kitchen/optimistic-bootstrap"
import type { KdsBootstrap } from "./use-kitchen-tickets"
import { useKdsSocketConnected } from "../realtime/kds-socket"
import { patchDiningTableStatus } from "./use-dining-tables"
import { findCachedDiningTableId } from "./use-table-sessions"
import { operationalMutationHeaders, type OperationalMutationOptions } from "../operational-mutation"
import type {
  CreateOrderInput,
  CreateOrderItemAddonInput,
  CreateOrderItemInput,
  CreateOrderItemsBatchInput,
  UpdateOrderInput,
} from "@rms/validators/orders"

export interface Order {
  id: number
  outletId: number
  tableSessionId: number | null
  customerId: number | null
  reservationId: number | null
  createdBy: number | null
  orderNumber: string
  /** Internal bill identifier — UUID for global uniqueness. */
  billId: string
  /** Guest-facing bill number, formatted per Settings > POS — see OrdersService#generateBillNumber. Null for orders created before this field existed. */
  billNumber: string | null
  /** Formal invoice number — generated on-demand, formatted per Settings > POS. Null if no invoice has been issued yet. */
  invoiceNumber: string | null
  /** Timestamp when invoice was generated. Null if no invoice has been issued yet. */
  invoiceGeneratedAt: string | null
  orderType: string
  tableName?: string | null
  customerName?: string | null
  /** Who placed it: walk_in/phone/online/staff/other. */
  source: string
  /** Which surface it came through: pos/qr/waiter/online. */
  orderSource: string
  status: string
  paymentStatus: string
  approvalStatus: "pending" | "accepted" | "rejected"
  cancelledAt: string | null
  cancelReason: string | null
  completedAt: string | null
  note: string | null
  subtotal: number
  discountType: string | null
  discountValue: number
  discountAmount: number
  serviceChargeAmount: number
  taxAmount: number
  grandTotal: number
  paidAmount: number
  dueAmount: number
  refundedAmount: number
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: number
  orderId: number
  /** Denormalized from the parent order — lets items be queried across a whole table visit, which can span several orders. */
  tableSessionId: number | null
  foodId: number
  foodVariantId: number | null
  preparationDepartmentId: number | null
  quantity: number
  unitPrice: number
  totalAmount: number
  status: string
  isHeld: boolean
  note: string | null
  packagingType: "plating" | "takeaway"
  /** When the item was added to the order (its ordered time). */
  createdAt: string
  /** Last status change (sent → preparing → ready → served) — the order-tracking "updated" time. */
  updatedAt: string
  // Embedded by GET /order-items so cart/order-detail rows don't each need
  // their own /order-items/:id/addons and /order-items/:id/reservations call.
  addons: OrderItemAddon[]
  reservations: OrderItemIngredientReservation[]
}

export interface OrderItemAddon {
  id: number
  orderItemId: number
  addonId: number
  quantity: number
  unitPrice: number
  totalAmount: number
}

export interface OrderItemIngredientReservation {
  id: number
  orderItemId: number
  warehouseId: number
  ingredientId: number
  reservedQuantity: number
  consumedQuantity: number
  status: "reserved" | "consumed" | "released"
}

export interface ListOrdersParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
  tableSessionId?: number
  status?: string
  /** Statuses to leave out (e.g. ["completed", "cancelled"] for an "open orders" view). Ignored if `status` is set. */
  excludeStatus?: string[]
  createdFrom?: string
  createdTo?: string
}

export function useOrders(params: ListOrdersParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => apiClient<PaginatedResponse<Order>>(`/orders${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  })
}

export interface OrderStatusHistoryEntry {
  id: number
  orderId: number
  changedBy: number | null
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
}

/** Every recorded status transition for an order, oldest first. */
export function useOrderStatusHistory(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.statusHistory(orderId),
    queryFn: () => apiClient<OrderStatusHistoryEntry[]>(`/orders/${orderId}/status-history`),
    enabled: orderId > 0,
  })
}

export function useOrder(id: number, initialData?: Order) {
  const realtimeConnected = useKdsSocketConnected()

  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => apiClient<Order>(`/orders/${id}`),
    enabled: id > 0,
    // A caller that already has this exact order from a list response (e.g.
    // the table deep-link resolving its one open order via GET /orders?
    // tableSessionId=) can pass it here so the screen renders instantly
    // instead of a blank/loading state. initialDataUpdatedAt=0 marks it as
    // already stale (rather than "just fetched") so this still kicks off a
    // real GET /orders/:id in the background on mount — the list response it
    // came from was fetched separately and can itself be a few seconds old
    // (e.g. missing an item another device just added), so it must not get
    // to claim the full 30s staleTime for itself.
    initialData,
    initialDataUpdatedAt: 0,
    // The KDS realtime push is the primary path for order updates; this poll
    // is only the fallback if the socket connection drops — same gating as
    // useOrderItems, which this was missing (was polling every open order
    // screen every 30s even with a live socket).
    refetchInterval: realtimeConnected ? false : 30_000,
  })
}

export function useCreateOrder(options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => apiClient<Order>("/orders", { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() }),
  })
}

/** Pushes a locally-built POS cart (items + their addons) in one request — see orders.service#addItemsBatch. */
export function useAddOrderItemsBatch(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderItemsBatchInput) =>
      apiClient<OrderItem[]>(`/orders/${orderId}/items/batch`, { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

/**
 * Absolute-value PATCH (not a delta) — replaying a queued update converges
 * to the same state, so this is safe to auto-queue while offline. See
 * queuable-api-client.ts.
 */
export function useUpdateOrder(id: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOrderInput) =>
      options.closedHoursOverride
        ? apiClient<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(input), headers: operationalMutationHeaders(true) })
        : queuableApiClient<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }, "Update order totals"),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.detail(id) })
      const previous = queryClient.getQueryData<Order>(queryKeys.orders.detail(id))
      queryClient.setQueryData<Order>(queryKeys.orders.detail(id), (old) =>
        old ? { ...old, ...input } : old,
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.detail(id), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() })
    },
  })
}

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

/**
 * True only when the cache can *positively confirm* that no other order on
 * this session is still open — i.e. that completing this one is what ends the
 * session and frees the table. OrdersService#freeTableForCompletedOrder only
 * frees the table when the completed order was the last active one, so
 * guessing wrong here would flash a table green that the backend left
 * occupied.
 *
 * Deliberately conservative: it needs a cached list actually scoped to this
 * tableSessionId, skips `status`/`search`-filtered lists (a
 * `status: "completed"` list would trivially look like everything is closed)
 * and partially-cached pages. Returning false on an unknown cache is the safe
 * direction — the caller just skips its optimistic patch and lets the refetch
 * settle it.
 */
function isLastOpenOrderForSession(
  queryClient: QueryClient,
  tableSessionId: number,
  completedOrderId: number,
): boolean {
  let confirmed = false
  for (const [key, data] of queryClient.getQueriesData<PaginatedResponse<Order>>({
    queryKey: queryKeys.orders.lists(),
  })) {
    if (!data) continue
    const params = (key[2] as ListOrdersParams | undefined) ?? {}
    if (params.tableSessionId !== tableSessionId) continue
    if (params.status !== undefined || params.search) continue
    if (data.data.length < data.meta.total) continue
    if (
      data.data.some(
        (order) => order.id !== completedOrderId && !CLOSED_ORDER_STATUSES.has(order.status),
      )
    ) {
      return false
    }
    confirmed = true
  }
  return confirmed
}

export interface UpdateOrderStatusInput {
  status: string
  note?: string
  /** status="completed" only — closes the order out even with items that never reached 'served', voiding them instead. Requires orders.delete. See OrdersService#updateStatus. */
  force?: boolean
  /** status="completed" only — closes the order out even with items that never reached 'served', marking them served (not voided) instead, so the sale still charges for them. No extra permission required. `force` wins if both are set. See OrdersService#updateStatus. */
  autoServe?: boolean
}

export function useUpdateOrderStatus(id: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: string | UpdateOrderStatusInput) => {
      const body = typeof input === "string" ? { status: input } : input
      return apiClient<Order>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body), headers: operationalMutationHeaders(options.closedHoursOverride) })
    },
    // The status badge (POS header, order list, kitchen/waiter screens) flips
    // the instant staff tap the action instead of sitting on the old status
    // until the round trip resolves — rolled back on error. Completing the
    // last open order on a table session also frees the table the same
    // instant (see patchDiningTableStatus) instead of waiting for the round
    // trip — rolled back to 'occupied' if the request fails.
    onMutate: async (input) => {
      const status = typeof input === "string" ? input : input.status
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.detail(id) })
      const previous = queryClient.getQueryData<Order>(queryKeys.orders.detail(id))
      queryClient.setQueryData<Order>(queryKeys.orders.detail(id), (old) =>
        old ? { ...old, status } : old,
      )

      let patchedDiningTableId: number | null = null
      if (
        status === "completed" &&
        previous?.tableSessionId &&
        isLastOpenOrderForSession(queryClient, previous.tableSessionId, id)
      ) {
        const diningTableId = findCachedDiningTableId(queryClient, previous.tableSessionId)
        if (diningTableId !== null) {
          patchDiningTableStatus(queryClient, diningTableId, "available")
          patchedDiningTableId = diningTableId
        }
      }

      return { previous, patchedDiningTableId }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.detail(id), context.previous)
      if (context?.patchedDiningTableId != null) {
        patchDiningTableStatus(queryClient, context.patchedDiningTableId, "occupied")
      }
    },
    onSuccess: (order, input) => {
      const status = typeof input === "string" ? input : input.status
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
      // Force-completing can void items, which changes stock reservations —
      // refresh the item list so the cart/kitchen views don't show stale
      // 'stock_reserved'/'sent_to_kitchen' rows.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(id) })
      // Completing a dine-in order can auto-end its table session server-side
      // (OrdersService#freeTableForCompletedOrder), freeing the table with it.
      // refetchType "all" because the floor board is usually unmounted at this
      // point — staff complete the sale from the POS/checkout screen — and the
      // default active-only invalidation would merely flag its dining-tables
      // query stale, deferring the GET until the board is next mounted.
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists(), refetchType: "all" })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists(), refetchType: "all" })

      // ...and paint the table available immediately, so it doesn't sit red
      // until that refetch lands. Only when the cache can prove this was the
      // session's last open order (see isLastOpenOrderForSession).
      if (status !== "completed" || !order?.tableSessionId) return
      if (!isLastOpenOrderForSession(queryClient, order.tableSessionId, id)) return
      const diningTableId = findCachedDiningTableId(queryClient, order.tableSessionId)
      if (diningTableId !== null) patchDiningTableStatus(queryClient, diningTableId, "available")
    },
  })
}

export function useSendOrderToKitchen(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemIds: number[]) => apiClient<{ orderId: number; itemIds: number[]; ticketIds: number[] }>(`/orders/${orderId}/send-to-kitchen`, { method: "POST", body: JSON.stringify({ itemIds }), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    // "Place order" — the cart's items flip to sent immediately instead of
    // waiting on the round trip; rolled back on error. (Exact target status
    // — 'ready' for ready-made items vs 'sent_to_kitchen' for kitchen-bound
    // ones — is a server routing decision, so this optimistically assumes
    // the common case and the settle-time refetch below corrects it either
    // way.)
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previous = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      const idSet = new Set(itemIds)
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) =>
                idSet.has(item.id) && item.status === "stock_reserved"
                  ? { ...item, status: "sent_to_kitchen" }
                  : item,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _itemIds, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

export function useFireHeldItems(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<unknown>(`/orders/${orderId}/fire-held-items`, { method: "POST", headers: operationalMutationHeaders(options.closedHoursOverride) }),
    // Held items flip to sent immediately instead of waiting on the round
    // trip — same idea as useSendOrderToKitchen. Rolled back on error.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previous = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) =>
                item.isHeld && item.status === "stock_reserved"
                  ? { ...item, isHeld: false, status: "sent_to_kitchen" }
                  : item,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

/** Waitstaff "Mark Delivered" from the ready queue — serves every ready item across the order's tickets. */
export function useMarkOrderReadyItemsServed(orderId: number, outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<unknown>(`/orders/${orderId}/mark-ready-items-served`, { method: "POST" }),
    // Every 'ready' item flips to 'served' the instant staff tap the
    // button — this is the highest-frequency waiter action on a busy floor,
    // so it shouldn't sit waiting on the round trip. Patches both the order's
    // own item list AND the KDS bootstrap (the ready queue screen renders
    // off the latter, not the former). Rolled back on error.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previousItems = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) => (item.status === "ready" ? { ...item, status: "served" } : item)),
            }
          : old,
      )

      let previousBootstrap: KdsBootstrap | undefined
      if (outletId) {
        const bootstrapKey = queryKeys.kitchenTickets.bootstrap(outletId)
        await queryClient.cancelQueries({ queryKey: bootstrapKey })
        previousBootstrap = queryClient.getQueryData<KdsBootstrap>(bootstrapKey)
        if (previousBootstrap) {
          queryClient.setQueryData<KdsBootstrap>(bootstrapKey, applyOrderReadyItemsServed(previousBootstrap, orderId))
        }
      }
      return { previousItems, previousBootstrap }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previousItems)
      if (outletId && context?.previousBootstrap) {
        queryClient.setQueryData(queryKeys.kitchenTickets.bootstrap(outletId), context.previousBootstrap)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      if (outletId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      }
    },
  })
}

/** Waitstaff "Mark Delivered" for one ready kitchen item. */
export function useMarkOrderReadyItemServed(orderId: number, outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketItemId: number) =>
      apiClient<unknown>(`/orders/${orderId}/mark-ready-item-served/${ticketItemId}`, { method: "POST" }),
    // Same idea as useMarkOrderReadyItemsServed, scoped to the one ticket
    // item the ready-queue card is delivering.
    onMutate: async (ticketItemId) => {
      if (!outletId) return {}
      const bootstrapKey = queryKeys.kitchenTickets.bootstrap(outletId)
      await queryClient.cancelQueries({ queryKey: bootstrapKey })
      const previousBootstrap = queryClient.getQueryData<KdsBootstrap>(bootstrapKey)
      if (previousBootstrap) {
        queryClient.setQueryData<KdsBootstrap>(
          bootstrapKey,
          applyOrderTicketItemServed(previousBootstrap, orderId, ticketItemId),
        )
      }
      return { previousBootstrap }
    },
    onError: (_err, _ticketItemId, context) => {
      if (outletId && context?.previousBootstrap) {
        queryClient.setQueryData(queryKeys.kitchenTickets.bootstrap(outletId), context.previousBootstrap)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      if (outletId) queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
    },
  })
}

export function useOrderItems(orderId: number) {
  const realtimeConnected = useKdsSocketConnected()

  return useQuery({
    queryKey: queryKeys.orders.items(orderId),
    queryFn: () => apiClient<PaginatedResponse<OrderItem>>(`/order-items${toQueryString({ orderId, limit: 100 })}`),
    enabled: orderId > 0,
    // The KDS realtime push is the primary path for kitchen status changes;
    // this poll is the fallback if the socket connection drops.
    refetchInterval: realtimeConnected ? false : 30_000,
  })
}

/** Every item ordered during a table's whole visit, across every Order row the session has accumulated (new rounds, split bills). */
export function useTableSessionItems(tableSessionId: number) {
  const realtimeConnected = useKdsSocketConnected()

  return useQuery({
    queryKey: queryKeys.tableSessions.items(tableSessionId),
    queryFn: () =>
      apiClient<PaginatedResponse<OrderItem>>(`/order-items${toQueryString({ tableSessionId, limit: 100 })}`),
    enabled: tableSessionId > 0,
    refetchInterval: realtimeConnected ? false : 30_000,
  })
}

/**
 * One row per (food, variant) of an order — or, on the table-session read,
 * the same rolled up across every order of the visit. Read straight from
 * table_session_food_status_counts, the DB-trigger-maintained rollup that
 * every status display derives from, so nothing is aggregated client-side.
 */
export interface FoodStatusCount {
  orderId: number
  foodId: number
  foodName: string
  foodVariantId: number | null
  foodVariantName: string | null
  /** Null for grab-and-go/takeaway, which has no table to roll up to. */
  tableSessionId: number | null
  /** Still in the cart — not yet sent to the kitchen. */
  reservedCount: number
  orderedCount: number
  preparingCount: number
  readyCount: number
  servedCount: number
  cancelledCount: number
  /** When the earliest line of this food+variant was added — use for KDS aging. */
  createdAt: string
  updatedAt: string
}

/** Kitchen-pipeline counts for one order — covers grab-and-go, which has no session. */
export function useOrderFoodStatusCounts(orderId: number) {
  const realtimeConnected = useKdsSocketConnected()

  return useQuery({
    queryKey: queryKeys.orders.statusCounts(orderId),
    queryFn: () =>
      apiClient<FoodStatusCount[]>(
        `/order-items/status-counts${toQueryString({ orderId })}`,
      ),
    enabled: orderId > 0,
    refetchInterval: realtimeConnected ? false : 30_000,
  })
}

/** The same counts for a table's whole visit, rolled up across its orders. */
export function useTableSessionFoodStatusCounts(tableSessionId: number) {
  const realtimeConnected = useKdsSocketConnected()

  return useQuery({
    queryKey: queryKeys.tableSessions.statusCounts(tableSessionId),
    queryFn: () =>
      apiClient<FoodStatusCount[]>(
        `/order-items/status-counts${toQueryString({ tableSessionId })}`,
      ),
    enabled: tableSessionId > 0,
    refetchInterval: realtimeConnected ? false : 30_000,
  })
}

export function useAddOrderItem(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderItemInput) =>
      apiClient<OrderItem>(`/orders/${orderId}/items`, { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

/**
 * Absolute-value PATCH — quantity/note/isHeld are target values, not deltas,
 * so replaying a queued update converges to the same state. Safe to
 * auto-queue while offline. See queuable-api-client.ts.
 */
export function useUpdateOrderItem(orderId: number, itemId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      quantity?: number
      status?: string
      note?: string
      isHeld?: boolean
      packagingType?: "plating" | "takeaway"
    }) =>
      options.closedHoursOverride
        ? apiClient<OrderItem>(`/order-items/${itemId}`, { method: "PATCH", body: JSON.stringify(input), headers: operationalMutationHeaders(true) })
        : queuableApiClient<OrderItem>(
            `/order-items/${itemId}`,
            { method: "PATCH", body: JSON.stringify(input) },
            "Update order item",
          ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previous = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      ...input,
                      totalAmount: item.unitPrice * (input.quantity ?? item.quantity),
                    }
                  : item,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.reservations(itemId) })
    },
  })
}

/** DELETE by id — a no-op if replayed twice, safe to auto-queue while offline. */
export function useRemoveOrderItem(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      options.closedHoursOverride
        ? apiClient<void>(`/order-items/${itemId}`, { method: "DELETE", headers: operationalMutationHeaders(true) })
        : queuableApiClient<void>(`/order-items/${itemId}`, { method: "DELETE" }, "Remove order item"),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previous = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old ? { ...old, data: old.data.filter((item) => item.id !== itemId) } : old,
      )
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

export function useOrderItemAddons(orderId: number, itemId: number) {
  return useQuery({
    queryKey: queryKeys.orderItems.addons(itemId),
    queryFn: () => apiClient<OrderItemAddon[]>(`/order-items/${itemId}/addons`),
    enabled: itemId > 0,
  })
}

export function useAddOrderItemAddon(orderId: number, itemId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderItemAddonInput) =>
      apiClient<OrderItemAddon>(`/order-items/${itemId}/addons`, { method: "POST", body: JSON.stringify(input), headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.addons(itemId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.reservations(itemId) })
    },
  })
}

/** DELETE by id — a no-op if replayed twice, safe to auto-queue while offline. */
export function useRemoveOrderItemAddon(orderId: number, itemId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonId: number) =>
      options.closedHoursOverride
        ? apiClient<void>(`/order-items/${itemId}/addons/${addonId}`, { method: "DELETE", headers: operationalMutationHeaders(true) })
        : queuableApiClient<void>(
            `/order-items/${itemId}/addons/${addonId}`,
            { method: "DELETE" },
            "Remove order item addon",
          ),
    onMutate: async (addonId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.items(orderId) })
      const previous = queryClient.getQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId))
      queryClient.setQueryData<PaginatedResponse<OrderItem>>(queryKeys.orders.items(orderId), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((item) =>
                item.id === itemId
                  ? { ...item, addons: item.addons.filter((addon) => addon.addonId !== addonId) }
                  : item,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _addonId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.orders.items(orderId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.addons(itemId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.reservations(itemId) })
    },
  })
}

/** Read-only — a side effect of item/addon add-remove and order completion/cancellation. */
export function useOrderItemReservations(itemId: number) {
  return useQuery({
    queryKey: queryKeys.orderItems.reservations(itemId),
    queryFn: () => apiClient<OrderItemIngredientReservation[]>(`/order-items/${itemId}/reservations`),
    enabled: itemId > 0,
  })
}

/** Issue a formal invoice for an order on-demand. Returns the order with invoiceNumber and invoiceGeneratedAt set. */
export function useIssueInvoice(orderId: number, options: OperationalMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<Order>(`/orders/${orderId}/invoice`, { method: "POST", headers: operationalMutationHeaders(options.closedHoursOverride) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}
