"use client"

import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"

/** Sums an ingredient's stock quantity across all warehouses. */
export function KitItemStock({ ingredientId }: { ingredientId: number }) {
  const { data: stocks } = useWarehouseIngredientStocks({ ingredientId, limit: 100 })
  const total = stocks?.data.reduce((sum, stock) => sum + stock.quantity, 0) ?? 0
  return <span className="tabular-nums">{total}</span>
}
