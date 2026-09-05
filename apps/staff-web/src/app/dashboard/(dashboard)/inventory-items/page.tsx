"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DownloadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { CreateIngredientDialog } from "../ingredients/create-ingredient-dialog"
import { EditInventoryItemDialog } from "./edit-inventory-item-dialog"

const money = (value: number) => value.toFixed(2)
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export default function InventoryItemsPage() {
  return <InventoryItemsList readOnly={false} />
}

export function InventoryItemsList({ readOnly }: { readOnly: boolean }) {
  const { outletId } = useActiveOutlet()
  const [warehouseId, setWarehouseId] = useState<string>("all")

  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({
    limit: 100,
    outletId: outletId ?? undefined,
  })
  const { data: ingredients, isLoading: ingredientsLoading } = useIngredients({
    limit: 500,
    outletId: outletId ?? undefined,
  })
  const { data: units, isLoading: unitsLoading } = useUnits({ limit: 500 })
  const selectedWarehouseId = warehouseId !== "all" ? Number(warehouseId) : undefined
  const { data: stocks, isLoading: stocksLoading } = useWarehouseIngredientStocks({
    warehouseId: selectedWarehouseId,
  })

  const rows = useMemo(() => {
    const ingredientById = new Map((ingredients?.data ?? []).map((ingredient) => [ingredient.id, ingredient]))
    const unitById = new Map((units?.data ?? []).map((unit) => [unit.id, unit]))
    const outletWarehouseIds = new Set((warehouses?.data ?? []).map((warehouse) => warehouse.id))

    return (stocks?.data ?? [])
      .filter((stock) => outletWarehouseIds.has(stock.warehouseId))
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
  }, [ingredients, stocks, units, warehouses])

  const isLoading = warehousesLoading || ingredientsLoading || unitsLoading || stocksLoading
  const showSkeleton = useDelayedLoading(isLoading)

  function handleExport() {
    const header = ["Name", "Item code", "Category", "Unit", "Location", "Total quantity", "Available", "Avg. cost", "Total cost", "Buying price", "Selling price"]
    const data = rows.map(({ ingredient, stock, unit }) => {
      const location = warehouses?.data.find((warehouse) => warehouse.id === stock.warehouseId)
      return [
        ingredient.name,
        ingredient.code,
        ingredient.category.name,
        unit?.shortName ?? unit?.name ?? "",
        location?.name ?? `Warehouse #${stock.warehouseId}`,
        stock.quantity,
        Math.max(0, stock.quantity - stock.reservedQuantity),
        money(stock.averageCost),
        money(stock.stockValue),
        money(stock.averageCost),
        money(ingredient.sellingPrice),
      ]
    })
    const csv = [header, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "inventory-items.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  usePageTitle("Inventory Items")

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Inventory Items</h1>
            <p className="text-sm text-muted-foreground">Current stock, average cost, and total value by warehouse.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isLoading || rows.length === 0} onClick={handleExport}>
              <DownloadIcon /> Export CSV
            </Button>
            {!readOnly && <CreateIngredientDialog />}
          </div>
        </div>
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Location</label>
        <Select value={warehouseId} onValueChange={(value) => setWarehouseId(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses?.data.map((warehouse) => (
              <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={12} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Item code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Total quantity</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Avg. cost</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
              <TableHead className="text-right">Buying price</TableHead>
              <TableHead className="text-right">Selling price</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  {warehouses?.data.length ? "No inventory items in these warehouses." : "No warehouses found."}
                </TableCell>
              </TableRow>
            ) : rows.map(({ ingredient, stock, unit }) => {
              const location = warehouses?.data.find((warehouse) => warehouse.id === stock.warehouseId)
              return (
                <TableRow key={stock.id}>
                  <TableCell>
                    {readOnly ? <span className="font-medium">{ingredient.name}</span> : <Link href={`/dashboard/ingredients/${ingredient.id}`} className="font-medium hover:underline">{ingredient.name}</Link>}
                    {!ingredient.isActive && <Badge variant="destructive" className="ml-2">inactive</Badge>}
                  </TableCell>
                  <TableCell>{ingredient.code}</TableCell>
                  <TableCell>{ingredient.category.name}</TableCell>
                  <TableCell>{unit?.shortName ?? unit?.name ?? "—"}</TableCell>
                  <TableCell>{location?.name ?? `Warehouse #${stock.warehouseId}`}</TableCell>
                  <TableCell className="text-right">{stock.quantity}</TableCell>
                  <TableCell className="text-right">
                    {Math.max(0, stock.quantity - stock.reservedQuantity)}
                  </TableCell>
                  <TableCell className="text-right">{money(stock.averageCost)}</TableCell>
                  <TableCell className="text-right">{money(stock.stockValue)}</TableCell>
                  <TableCell className="text-right">{money(stock.averageCost)}</TableCell>
                  <TableCell className="text-right">{money(ingredient.sellingPrice)}</TableCell>
                  <TableCell className="text-right">
                    {!readOnly && <EditInventoryItemDialog ingredient={ingredient} />}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
