import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { queuableApiClient } from "@/lib/offline/queuable-api-client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type {
  AssignOrderTableInput,
  CreateOrderInput,
  CreateOrderItemAddonInput,
  CreateOrderItemInput,
  UpdateOrderInput,
} from "@/lib/validators/orders"

export interface Order {
  id: number
  outletId: number
  tableSessionId: number | null
  customerId: number | null
  reservationId: number | null
  orderNumber: string
  orderType: string
  status: string
  paymentStatus: string
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
  foodId: number
  foodVariantId: number | null
  preparationDepartmentId: number | null
  quantity: number
  unitPrice: number
  totalAmount: number
  status: string
  isHeld: boolean
  note: string | null
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

export interface OrderTableAssignment {
  id: number
  orderId: number
  diningTableId: number
  assignmentType: string
}

export interface ListOrdersParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
  tableSessionId?: number
  status?: string
}

export function useOrders(params: ListOrdersParams = {}) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => apiClient<PaginatedResponse<Order>>(`/orders${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => apiClient<Order>(`/orders/${id}`),
    enabled: id > 0,
    // Fallback in case a websocket event is missed — mirrors useKdsBootstrap.
    refetchInterval: 30_000,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => apiClient<Order>("/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() }),
  })
}

/**
 * Absolute-value PATCH (not a delta) — replaying a queued update converges
 * to the same state, so this is safe to auto-queue while offline. See
 * queuable-api-client.ts.
 */
export function useUpdateOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOrderInput) =>
      queuableApiClient<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }, "Update order totals"),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) }),
  })
}

export function useUpdateOrderStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      apiClient<Order>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
      // Completing a dine-in order can auto-end its table session server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}

export function useSendOrderToKitchen(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<unknown>(`/orders/${orderId}/send-to-kitchen`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}

export function useFireHeldItems(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<unknown>(`/orders/${orderId}/fire-held-items`, { method: "POST" }),
    onSuccess: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      if (outletId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchenTickets.bootstrap(outletId) })
      }
    },
  })
}

export function useOrderItems(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.items(orderId),
    queryFn: () => apiClient<PaginatedResponse<OrderItem>>(`/order-items${toQueryString({ orderId, limit: 100 })}`),
    enabled: orderId > 0,
    // The KDS realtime push is the primary path for kitchen status changes;
    // this poll is the fallback if the socket connection drops.
    refetchInterval: 30_000,
  })
}

export function useAddOrderItem(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderItemInput) =>
      apiClient<OrderItem>(`/orders/${orderId}/items`, { method: "POST", body: JSON.stringify(input) }),
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
export function useUpdateOrderItem(orderId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { quantity?: number; status?: string; note?: string; isHeld?: boolean }) =>
      queuableApiClient<OrderItem>(
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
export function useRemoveOrderItem(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      queuableApiClient<void>(`/order-items/${itemId}`, { method: "DELETE" }, "Remove order item"),
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

export function useAddOrderItemAddon(orderId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderItemAddonInput) =>
      apiClient<OrderItemAddon>(`/order-items/${itemId}/addons`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.addons(itemId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.reservations(itemId) })
    },
  })
}

/** DELETE by id — a no-op if replayed twice, safe to auto-queue while offline. */
export function useRemoveOrderItemAddon(orderId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonId: number) =>
      queuableApiClient<void>(
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

export function useOrderTables(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.tables(orderId),
    queryFn: () => apiClient<OrderTableAssignment[]>(`/orders/${orderId}/tables`),
    enabled: orderId > 0,
  })
}

export function useAssignOrderTable(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignOrderTableInput) =>
      apiClient<OrderTableAssignment>(`/orders/${orderId}/tables`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.tables(orderId) }),
  })
}

export function useUnassignOrderTable(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (diningTableId: number) =>
      apiClient<void>(`/orders/${orderId}/tables/${diningTableId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.tables(orderId) }),
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
