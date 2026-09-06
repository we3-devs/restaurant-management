import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type {
  AddPurchaseOrderItemInput,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput,
} from "@rms/validators/purchase-orders"

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "partially_received"
  | "received"
  | "completed"
  | "cancelled"

export interface PurchaseOrder {
  id: number
  poNo: string
  supplierId: number
  outletId: number
  outlet?: {
    id: number
    name: string
    tenant?: { id: number; name: string }
  }
  warehouseId: number
  expectedDeliveryDate: string | null
  currency: string
  notes: string | null
  status: PurchaseOrderStatus
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  createdBy: number | null
  approvedBy: number | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderItem {
  id: number
  purchaseOrderId: number
  ingredientId: number
  quantity: number
  unit: string | null
  unitCost: number
  discount: number
  tax: number
  total: number
  receivedQuantity: number
  remainingQuantity: number
}

export interface ListPurchaseOrdersParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  supplierId?: number
  outletId?: number
  warehouseId?: number
}

export function usePurchaseOrders(params: ListPurchaseOrdersParams = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list(params),
    queryFn: () => apiClient<PaginatedResponse<PurchaseOrder>>(`/purchase-orders${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id),
    queryFn: () => apiClient<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: id > 0,
  })
}

export function usePurchaseOrderItems(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.items(id),
    queryFn: () => apiClient<PurchaseOrderItem[]>(`/purchase-orders/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) =>
      apiClient<PurchaseOrder>("/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() }),
  })
}

export function useUpdatePurchaseOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePurchaseOrderInput) =>
      apiClient<PurchaseOrder>(`/purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
    },
  })
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/purchase-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() }),
  })
}

function invalidatePo(queryClient: ReturnType<typeof useQueryClient>, id: number) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(id) })
}

export function useSubmitPurchaseOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<PurchaseOrder>(`/purchase-orders/${id}/submit`, { method: "POST" }),
    onSuccess: () => invalidatePo(queryClient, id),
  })
}

export function useApprovePurchaseOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<PurchaseOrder>(`/purchase-orders/${id}/approve`, { method: "POST" }),
    onSuccess: () => invalidatePo(queryClient, id),
  })
}

export function useRejectPurchaseOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<PurchaseOrder>(`/purchase-orders/${id}/reject`, { method: "POST" }),
    onSuccess: () => invalidatePo(queryClient, id),
  })
}

export function useCancelPurchaseOrder(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { method: "POST" }),
    onSuccess: () => invalidatePo(queryClient, id),
  })
}

export function useAddPurchaseOrderItem(poId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddPurchaseOrderItemInput) =>
      apiClient<PurchaseOrderItem>(`/purchase-orders/${poId}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.items(poId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(poId) })
    },
  })
}

export function useUpdatePurchaseOrderItem(poId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePurchaseOrderItemInput) =>
      apiClient<PurchaseOrderItem>(`/purchase-orders/${poId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.items(poId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(poId) })
    },
  })
}

export function useRemovePurchaseOrderItem(poId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/purchase-orders/${poId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.items(poId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(poId) })
    },
  })
}
