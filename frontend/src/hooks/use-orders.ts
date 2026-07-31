import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
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
  preparationDepartmentId: number
  quantity: number
  unitPrice: number
  totalAmount: number
  status: string
  note: string | null
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
  })
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => apiClient<Order>(`/orders/${id}`),
    enabled: id > 0,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => apiClient<Order>("/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() }),
  })
}

export function useUpdateOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOrderInput) =>
      apiClient<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) }),
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
    },
  })
}

export function useOrderItems(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.items(orderId),
    queryFn: () => apiClient<PaginatedResponse<OrderItem>>(`/order-items${toQueryString({ orderId, limit: 100 })}`),
    enabled: orderId > 0,
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

export function useUpdateOrderItem(orderId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { quantity?: number; status?: string; note?: string }) =>
      apiClient<OrderItem>(`/order-items/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.items(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orderItems.reservations(itemId) })
    },
  })
}

export function useRemoveOrderItem(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/order-items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
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

export function useRemoveOrderItemAddon(orderId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonId: number) =>
      apiClient<void>(`/order-items/${itemId}/addons/${addonId}`, { method: "DELETE" }),
    onSuccess: () => {
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
