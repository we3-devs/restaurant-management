import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { CreateStockTransferInput, CreateStockTransferItemInput } from "@rms/validators/stock-transfers"

export interface StockTransfer {
  id: number
  transferNo: string
  fromWarehouseId: number
  toWarehouseId: number
  transferDate: string
  status: "draft" | "approved" | "cancelled"
  remarks: string | null
}

export interface StockTransferItem {
  id: number
  ingredientStockTransferId: number
  ingredientId: number
  requestedQuantity: number
  dispatchedQuantity: number
  receivedQuantity: number
  unitCost: number
  totalCost: number
}

export interface ListStockTransfersParams {
  page?: number
  limit?: number
  fromWarehouseId?: number
  toWarehouseId?: number
  status?: string
  search?: string
}

export function useStockTransfers(params: ListStockTransfersParams = {}) {
  return useQuery({
    queryKey: queryKeys.stockTransfers.list(params),
    queryFn: () => apiClient<PaginatedResponse<StockTransfer>>(`/stock-transfers${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStockTransfer(id: number) {
  return useQuery({
    queryKey: queryKeys.stockTransfers.detail(id),
    queryFn: () => apiClient<StockTransfer>(`/stock-transfers/${id}`),
    enabled: id > 0,
  })
}

export function useStockTransferItems(id: number) {
  return useQuery({
    queryKey: queryKeys.stockTransfers.items(id),
    queryFn: () => apiClient<StockTransferItem[]>(`/stock-transfers/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockTransferInput) =>
      apiClient<StockTransfer>("/stock-transfers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.lists() }),
  })
}

export function useAddStockTransferItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockTransferItemInput) =>
      apiClient<StockTransferItem>(`/stock-transfers/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.items(id) }),
  })
}

export function useRemoveStockTransferItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/stock-transfers/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.items(id) }),
  })
}

export function useApproveStockTransfer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockTransfer>(`/stock-transfers/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelStockTransfer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockTransfer>(`/stock-transfers/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.detail(id) }),
  })
}
