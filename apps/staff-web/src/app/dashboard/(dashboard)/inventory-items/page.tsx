"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useIngredients } from "@/hooks/use-ingredients"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useUnits } from "@/hooks/use-units"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"

const money = (value: number) => value.toFixed(2)

export default function InventoryItemsPage() {
  const { outletId } = useActiveOutlet()
  const [warehouseId, setWarehouseId] = useState<string>("")

  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({
    limit: 100,
    outletId: outletId ?? undefined,
  })
  const { data: ingredients, isLoading: ingredientsLoading } = useIngredients({
    limit: 500,
    outletId: outletId ?? undefined,
  })
  const { data: units, isLoading: unitsLoading } = useUnits({ limit: 500 })
  const selectedWarehouseId = warehouseId ? Number(warehouseId) : undefined
  const { data: stocks, isLoading: stocksLoading } = useWarehouseIngredientStocks({
    warehouseId: selectedWarehouseId,
  })

  useEffect(() => {
    if (!warehouseId && warehouses?.data[0]) {
      setWarehouseId(String(warehouses.data[0].id))
    }
  }, [warehouseId, warehouses])

  const rows = useMemo(() => {
    const ingredientById = new Map((ingredients?.data ?? []).map((ingredient) => [ingredient.id, ingredient]))
    const unitById = new Map((units?.data ?? []).map((unit) => [unit.id, unit]))

    return (stocks?.data ?? [])
      .map((stock) => {
        const ingredient = ingredientById.get(stock.ingredientId)
        if (!ingredient) return null
        return {
          stock,
          ingredient,
          unit: unitById.get(ingredient.baseUnitId),
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  }, [ingredients, stocks, units])

  const isLoading = warehousesLoading || ingredientsLoading || unitsLoading || stocksLoading
  const showSkeleton = useDelayedLoading(isLoading)

  usePageTitle("Inventory Items")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Inventory Items</h1>
        <p className="text-sm text-muted-foreground">Current stock, average cost, and total value by warehouse.</p>
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Location</label>
        <Select value={warehouseId} onValueChange={(value) => setWarehouseId(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses?.data.map((warehouse) => (
              <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={8} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Item code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Avg. cost</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {warehouses?.data.length ? "No inventory items in this location." : "No warehouses found."}
                </TableCell>
              </TableRow>
            ) : rows.map(({ ingredient, stock, unit }) => {
              const location = warehouses?.data.find((warehouse) => warehouse.id === stock.warehouseId)
              return (
                <TableRow key={stock.id}>
                  <TableCell>
                    <Link href={`/dashboard/ingredients/${ingredient.id}`} className="font-medium hover:underline">
                      {ingredient.name}
                    </Link>
                    {!ingredient.isActive && <Badge variant="destructive" className="ml-2">inactive</Badge>}
                  </TableCell>
                  <TableCell>{ingredient.code}</TableCell>
                  <TableCell>{ingredient.category.name}</TableCell>
                  <TableCell>{unit?.shortName ?? unit?.name ?? "—"}</TableCell>
                  <TableCell>{location?.name ?? `Warehouse #${stock.warehouseId}`}</TableCell>
                  <TableCell className="text-right">
                    {Math.max(0, stock.quantity - stock.reservedQuantity)}
                  </TableCell>
                  <TableCell className="text-right">{money(stock.averageCost)}</TableCell>
                  <TableCell className="text-right">{money(stock.stockValue)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
