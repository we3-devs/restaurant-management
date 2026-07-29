import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"

export interface WarehouseIngredientStock {
  id: number
  warehouseId: number
  ingredientId: number
  quantity: number
  averageCost: number
  stockValue: number
}

export interface InventoryTransaction {
  id: number
  ingredientId: number
  warehouseId: number
  transactionType: string
  quantityIn: number
  quantityOut: number
  balanceAfter: number
  unitCost: number
  totalCost: number
  referenceType: string | null
  referenceId: number | null
  createdAt: string
}

export interface ListWarehouseIngredientStocksParams {
  page?: number
  limit?: number
  warehouseId?: number
  ingredientId?: number
}

export interface ListInventoryTransactionsParams {
  page?: number
  limit?: number
  warehouseId?: number
  ingredientId?: number
  transactionType?: string
}

export function useWarehouseIngredientStocks(params: ListWarehouseIngredientStocksParams = {}) {
  return useQuery({
    queryKey: queryKeys.warehouseIngredientStocks.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<WarehouseIngredientStock>>(`/warehouse-ingredient-stocks${toQueryString(params)}`),
    enabled: params.ingredientId !== undefined || params.warehouseId !== undefined,
  })
}

export function useInventoryTransactions(params: ListInventoryTransactionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventoryTransactions.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<InventoryTransaction>>(`/inventory-transactions${toQueryString(params)}`),
    enabled: params.ingredientId !== undefined || params.warehouseId !== undefined,
  })
}
