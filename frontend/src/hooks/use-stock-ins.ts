import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateStockInInput, CreateStockInItemInput } from "@/lib/validators/stock-ins"

export interface StockIn {
  id: number
  stockInNo: string
  warehouseId: number
  stockInDate: string
  source: string
  status: "draft" | "approved" | "cancelled"
  remarks: string | null
}

export interface StockInItem {
  id: number
  ingredientStockInId: number
  ingredientId: number
  quantity: number
  unitCost: number
  totalCost: number
}

export interface ListStockInsParams {
  page?: number
  limit?: number
  warehouseId?: number
  status?: string
  search?: string
}

export function useStockIns(params: ListStockInsParams = {}) {
  return useQuery({
    queryKey: queryKeys.stockIns.list(params),
    queryFn: () => apiClient<PaginatedResponse<StockIn>>(`/stock-ins${toQueryString(params)}`),
  })
}

export function useStockIn(id: number) {
  return useQuery({
    queryKey: queryKeys.stockIns.detail(id),
    queryFn: () => apiClient<StockIn>(`/stock-ins/${id}`),
    enabled: id > 0,
  })
}

export function useStockInItems(id: number) {
  return useQuery({
    queryKey: queryKeys.stockIns.items(id),
    queryFn: () => apiClient<StockInItem[]>(`/stock-ins/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateStockIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockInInput) =>
      apiClient<StockIn>("/stock-ins", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.lists() }),
  })
}

export function useAddStockInItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockInItemInput) =>
      apiClient<StockInItem>(`/stock-ins/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.items(id) }),
  })
}

export function useRemoveStockInItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/stock-ins/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.items(id) }),
  })
}

export function useApproveStockIn(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockIn>(`/stock-ins/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelStockIn(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockIn>(`/stock-ins/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.detail(id) }),
  })
}
