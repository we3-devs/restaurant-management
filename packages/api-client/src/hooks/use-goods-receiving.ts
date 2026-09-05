import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { CreateGoodsReceivingInput } from "@rms/validators/goods-receiving"

export type GRNStatus = "draft" | "received" | "cancelled"

export interface GoodsReceiving {
  id: number
  grnNo: string
  purchaseOrderId: number | null
  supplierId: number
  outletId: number
  warehouseId: number
  receivedDate: string
  notes: string | null
  status: GRNStatus
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface GoodsReceivingItem {
  id: number
  goodsReceivingId: number
  purchaseOrderItemId: number | null
  ingredientId: number
  quantityReceived: number
  unitCost: number
  totalCost: number
  batchNo: string | null
  expiryDate: string | null
}

export interface ListGoodsReceivingParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  purchaseOrderId?: number
  outletId?: number
  warehouseId?: number
}

export function useGoodsReceivingList(params: ListGoodsReceivingParams = {}) {
  return useQuery({
    queryKey: queryKeys.goodsReceiving.list(params),
    queryFn: () => apiClient<PaginatedResponse<GoodsReceiving>>(`/goods-receiving${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useGoodsReceivingOne(id: number) {
  return useQuery({
    queryKey: queryKeys.goodsReceiving.detail(id),
    queryFn: () => apiClient<GoodsReceiving>(`/goods-receiving/${id}`),
    enabled: id > 0,
  })
}

export function useGoodsReceivingItems(id: number) {
  return useQuery({
    queryKey: queryKeys.goodsReceiving.items(id),
    queryFn: () => apiClient<GoodsReceivingItem[]>(`/goods-receiving/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateGoodsReceiving() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGoodsReceivingInput) =>
      apiClient<GoodsReceiving>("/goods-receiving", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goodsReceiving.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    },
  })
}

export function useCancelGoodsReceiving() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<GoodsReceiving>(`/goods-receiving/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goodsReceiving.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.goodsReceiving.detail(id) })
    },
  })
}
