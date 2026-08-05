import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreatePurchaseReturnInput } from "@/lib/validators/purchase-returns"

export type PurchaseReturnStatus = "draft" | "processed" | "cancelled"
export type RefundType = "refund" | "replacement" | "both"

export interface PurchaseReturn {
  id: number
  returnNo: string
  purchaseOrderId: number
  goodsReceivingId: number | null
  supplierId: number
  outletId: number
  warehouseId: number
  returnDate: string
  reason: string | null
  refundType: RefundType
  status: PurchaseReturnStatus
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface PurchaseReturnItem {
  id: number
  purchaseReturnId: number
  purchaseOrderItemId: number
  ingredientId: number
  quantity: number
  unitCost: number
  totalCost: number
}

export interface ListPurchaseReturnsParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  supplierId?: number
  outletId?: number
}

export function usePurchaseReturns(params: ListPurchaseReturnsParams = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseReturns.list(params),
    queryFn: () => apiClient<PaginatedResponse<PurchaseReturn>>(`/purchase-returns${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function usePurchaseReturn(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseReturns.detail(id),
    queryFn: () => apiClient<PurchaseReturn>(`/purchase-returns/${id}`),
    enabled: id > 0,
  })
}

export function usePurchaseReturnItems(id: number) {
  return useQuery({
    queryKey: queryKeys.purchaseReturns.items(id),
    queryFn: () => apiClient<PurchaseReturnItem[]>(`/purchase-returns/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreatePurchaseReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePurchaseReturnInput) =>
      apiClient<PurchaseReturn>("/purchase-returns", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns.lists() }),
  })
}

export function useProcessPurchaseReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<PurchaseReturn>(`/purchase-returns/${id}/process`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
    },
  })
}

export function useCancelPurchaseReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<PurchaseReturn>(`/purchase-returns/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReturns.detail(id) })
    },
  })
}
