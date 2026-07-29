import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateStockOutInput, CreateStockOutItemInput } from "@/lib/validators/stock-outs"

export interface StockOut {
  id: number
  stockOutNo: string
  warehouseId: number
  stockOutDate: string
  purpose: string
  status: "draft" | "approved" | "cancelled"
  remarks: string | null
}

export interface StockOutItem {
  id: number
  ingredientStockOutId: number
  ingredientId: number
  quantity: number
  unitCost: number
  totalCost: number
}

export interface ListStockOutsParams {
  page?: number
  limit?: number
  warehouseId?: number
  status?: string
  search?: string
}

export function useStockOuts(params: ListStockOutsParams = {}) {
  return useQuery({
    queryKey: queryKeys.stockOuts.list(params),
    queryFn: () => apiClient<PaginatedResponse<StockOut>>(`/stock-outs${toQueryString(params)}`),
  })
}

export function useStockOut(id: number) {
  return useQuery({
    queryKey: queryKeys.stockOuts.detail(id),
    queryFn: () => apiClient<StockOut>(`/stock-outs/${id}`),
    enabled: id > 0,
  })
}

export function useStockOutItems(id: number) {
  return useQuery({
    queryKey: queryKeys.stockOuts.items(id),
    queryFn: () => apiClient<StockOutItem[]>(`/stock-outs/${id}/items`),
    enabled: id > 0,
  })
}

export function useCreateStockOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockOutInput) =>
      apiClient<StockOut>("/stock-outs", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockOuts.lists() }),
  })
}

export function useAddStockOutItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockOutItemInput) =>
      apiClient<StockOutItem>(`/stock-outs/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockOuts.items(id) }),
  })
}

export function useRemoveStockOutItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => apiClient<void>(`/stock-outs/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockOuts.items(id) }),
  })
}

export function useApproveStockOut(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockOut>(`/stock-outs/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stockOuts.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}

export function useCancelStockOut(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<StockOut>(`/stock-outs/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stockOuts.detail(id) }),
  })
}
