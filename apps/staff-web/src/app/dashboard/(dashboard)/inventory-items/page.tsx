"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DownloadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useIngredients } from "@/hooks/use-ingredients"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useUnits } from "@/hooks/use-units"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useAnalyticsInventory } from "@/hooks/use-analytics"
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
  const today = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const inventoryAnalytics = useAnalyticsInventory({ outletId, dateFrom: from, dateTo: today })

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
    const header = ["Name", "Item code", "Tenant", "Outlet", "Category", "Unit", "Location", "Total quantity", "Available", "Avg. cost", "Total cost", "Buying price", "Selling price"]
    const data = rows.map(({ ingredient, stock, unit }) => {
      const location = warehouses?.data.find((warehouse) => warehouse.id === stock.warehouseId)
      return [
        ingredient.name,
        ingredient.code,
        ingredient.outlet?.tenant?.name ?? "",
        ingredient.outlet?.name ?? "",
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
    <div className="page-shell space-y-7">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{readOnly ? "Inventory Items Overview" : "Manage Inventory Items"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-2.5 py-1.5">
              <label htmlFor="inventory-location" className="text-xs font-medium text-muted-foreground">Location</label>
              <Select value={warehouseId} onValueChange={(value) => setWarehouseId(value ?? "")}>
                <SelectTrigger id="inventory-location" className="h-8 w-36 border-0 bg-transparent px-1.5 text-sm shadow-none focus:ring-0">
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses?.data.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" disabled={isLoading || rows.length === 0} onClick={handleExport}>
              <DownloadIcon /> Export CSV
            </Button>
            {readOnly ? <Button variant="outline" render={<Link href="/dashboard/inventory-items" />}>Manage Inventory</Button> : <CreateIngredientDialog />}
          </div>
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={14} />
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-card p-6 text-center text-sm text-muted-foreground">
              {warehouses?.data.length ? "No inventory items in these warehouses." : "No warehouses found."}
            </div>
          ) : rows.map(({ ingredient, stock, unit }) => {
            const location = warehouses?.data.find((warehouse) => warehouse.id === stock.warehouseId)
            return (
              <div key={stock.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {ingredient.image ? (
                    <img src={ingredient.image} alt="" className="size-12 shrink-0 rounded-xl border object-cover" />
                  ) : (
                    <div className="size-12 shrink-0 rounded-xl border bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    {readOnly ? <p className="truncate font-medium">{ingredient.name}</p> : <Link href={`/dashboard/ingredients/${ingredient.id}`} className="block truncate font-medium hover:underline">{ingredient.name}</Link>}
                    <p className="truncate text-xs text-muted-foreground">{ingredient.code} · {ingredient.category.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{ingredient.outlet?.tenant?.name ?? "—"} · {ingredient.outlet?.name ?? "—"}</p>
                  </div>
                  {!ingredient.isActive && <Badge variant="destructive">inactive</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Location</p><p className="truncate">{location?.name ?? `Warehouse #${stock.warehouseId}`}</p></div>
                  <div><p className="text-xs text-muted-foreground">Unit</p><p>{unit?.shortName ?? unit?.name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Available</p><p className="font-medium tabular-nums">{Math.max(0, stock.quantity - stock.reservedQuantity)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total quantity</p><p className="tabular-nums">{stock.quantity}</p></div>
                  <div><p className="text-xs text-muted-foreground">Avg. cost</p><p className="tabular-nums">{money(stock.averageCost)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Selling price</p><p className="tabular-nums">{money(ingredient.sellingPrice)}</p></div>
                </div>
                {!readOnly && <div className="mt-4 border-t pt-3"><EditInventoryItemDialog ingredient={ingredient} /></div>}
              </div>
            )
          })}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm md:block"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Item code</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Outlet</TableHead>
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
                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">
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
                  <TableCell>{ingredient.outlet?.tenant?.name ?? "—"}</TableCell>
                  <TableCell>{ingredient.outlet?.name ?? "—"}</TableCell>
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
        </Table></div>
        </>
      )}
      {readOnly && <Card className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm"><CardHeader><CardTitle>Recent inventory movement</CardTitle><CardDescription>Movement totals for the last 30 days</CardDescription></CardHeader><CardContent>{inventoryAnalytics.data?.movement.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{inventoryAnalytics.data.movement.map((movement) => <div key={movement.type} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"><span className="capitalize">{movement.type.replaceAll("_", " ")}</span><span className="font-semibold tabular-nums">{movement.quantity.toLocaleString()}</span></div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No inventory movement in this period.</p>}</CardContent></Card>}
    </div>
  )
}
