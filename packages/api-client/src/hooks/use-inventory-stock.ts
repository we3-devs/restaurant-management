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

interface PostStockInInput {
  warehouseId: number
  stockInDate: string
  source: "purchase" | "correction"
  remarks: string
  items: { ingredientId: number; quantity: number; unitCost: number }[]
}

/**
 * Stock rows are derived from the ledger, never written directly, so this
 * walks the same three-step document path the stock-in screen uses —
 * create draft, add the items, approve — and it's the approval that posts
 * `opening_stock` and materialises the rows. Callers therefore need
 * stock-ins.manage, not just inventory permissions.
 */
async function postApprovedStockIn({ items, ...header }: PostStockInInput): Promise<StockIn> {
  const stockIn = await apiClient<StockIn>("/stock-ins", { method: "POST", body: JSON.stringify(header) })

  // The draft exists from here on, so anything that fails after it has
  // to take it back out — the server rejects an untracked ingredient at
  // the add-item step, and an abandoned draft would otherwise pile up in
  // the stock-in list for every failed attempt.
  try {
    for (const item of items) {
      await apiClient<StockInItem>(`/stock-ins/${stockIn.id}/items`, { method: "POST", body: JSON.stringify(item) })
    }
    // A draft left unapproved posts nothing, so a failure here is a real
    // failure the caller must surface rather than swallow.
    return await apiClient<StockIn>(`/stock-ins/${stockIn.id}/approve`, { method: "POST" })
  } catch (error) {
    // Best-effort: the original error is what the user needs to see, so
    // a failed cleanup must not replace it.
    await apiClient<void>(`/stock-ins/${stockIn.id}`, { method: "DELETE" }).catch(() => undefined)
    throw error
  }
}

function useInvalidateStock() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryTransactions.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.stockIns.all })
  }
}

/** Brings an existing ingredient into a warehouse so it shows up as an inventory item. */
export function useCreateInventoryItem() {
  const invalidateStock = useInvalidateStock()
  return useMutation({
    mutationFn: ({ ingredientId, warehouseId, quantity, unitCost, remarks }: CreateInventoryItemInput) =>
      postApprovedStockIn({
        warehouseId,
        stockInDate: new Date().toISOString().slice(0, 10),
        source: "correction",
        remarks: remarks ?? "Opening stock",
        items: [{ ingredientId, quantity, unitCost }],
      }),
    onSuccess: invalidateStock,
  })
}

export interface ImportGoodsInput {
  warehouseId: number
  stockInDate: string
  remarks: string
  items: { ingredientId: number; quantity: number; unitCost: number }[]
}

/** Receives several tracked items at once as one approved purchase stock-in. */
export function useImportGoods() {
  const invalidateStock = useInvalidateStock()
  return useMutation({
    mutationFn: (input: ImportGoodsInput) => postApprovedStockIn({ ...input, source: "purchase" }),
    onSuccess: invalidateStock,
  })
}
