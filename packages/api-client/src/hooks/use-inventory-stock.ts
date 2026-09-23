import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { StockIn, StockInItem } from "./use-stock-ins"

export interface WarehouseIngredientStock {
  id: number
  warehouseId: number
  ingredientId: number
  quantity: number
  reservedQuantity: number
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
    enabled: true,
    placeholderData: keepPreviousData,
  })
}

export function useInventoryTransactions(params: ListInventoryTransactionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventoryTransactions.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<InventoryTransaction>>(`/inventory-transactions${toQueryString(params)}`),
    enabled: params.ingredientId !== undefined || params.warehouseId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export interface CreateInventoryItemInput {
  ingredientId: number
  warehouseId: number
  /** Opening balance. Must be > 0 — a stock-in with no quantity has nothing to post. */
  quantity: number
  unitCost: number
  remarks?: string
}

/**
 * Brings an existing ingredient into a warehouse so it shows up as an
 * inventory item.
 *
 * Stock rows are derived from the ledger, never written directly, so this
 * walks the same three-step document path the stock-in screen uses —
 * create draft, add the one item, approve — and it's the approval that
 * posts `opening_stock` and materialises the row. Callers therefore need
 * stock-ins.create, .update and .approve, not just inventory permissions.
 */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ingredientId, warehouseId, quantity, unitCost, remarks }: CreateInventoryItemInput) => {
      const stockIn = await apiClient<StockIn>("/stock-ins", {
        method: "POST",
        body: JSON.stringify({
          warehouseId,
          stockInDate: new Date().toISOString().slice(0, 10),
          source: "correction",
          remarks: remarks ?? "Opening stock",
        }),
      })

      // The draft exists from here on, so anything that fails after it has
      // to take it back out — the server rejects an untracked ingredient at
      // the add-item step, and an abandoned draft would otherwise pile up in
      // the stock-in list for every failed attempt.
      try {
        await apiClient<StockInItem>(`/stock-ins/${stockIn.id}/items`, {
          method: "POST",
          body: JSON.stringify({ ingredientId, quantity, unitCost }),
        })
        // A draft left unapproved posts nothing, so a failure here is a real
        // failure the dialog must surface rather than swallow.
        return await apiClient<StockIn>(`/stock-ins/${stockIn.id}/approve`, { method: "POST" })
      } catch (error) {
        // Best-effort: the original error is what the user needs to see, so
        // a failed cleanup must not replace it.
        await apiClient<void>(`/stock-ins/${stockIn.id}`, { method: "DELETE" }).catch(() => undefined)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryTransactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.all })
    },
  })
}
