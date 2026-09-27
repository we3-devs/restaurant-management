"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ListChecksIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import type { Ingredient } from "@/hooks/use-ingredients"
import { useImportGoods } from "@/hooks/use-inventory-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { isTrackedIngredientType } from "@/lib/validators/ingredient-categories"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { foodItemLabel, liveLink, localToday, useMenuStock } from "../_shared/use-menu-stock"

interface GoodsRow {
  ingredient: Ingredient
  label: string
  hint: string
}

interface Line {
  quantity: string
  unitCost: string
}

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ImportGoodsPage() {
  usePageTitle("Import Goods")
  const router = useRouter()
  const { outletId } = useActiveOutlet()
  const { permissions } = useCurrentUser()
  const canImport = permissions.includes("stock-ins.manage")
  const { data: warehouses } = useWarehouses({ limit: 100, outletId: outletId ?? undefined })
  const [warehouseChoice, setWarehouseChoice] = useState("")
  const defaultWarehouse = warehouses?.data.find((candidate) => candidate.isDefault) ?? warehouses?.data[0]
  const warehouseId = warehouseChoice ? Number(warehouseChoice) : defaultWarehouse?.id
  const { menuFoods, ingredientById, unitById, availableByIngredient, isLoading } = useMenuStock(warehouseId)
  const importGoods = useImportGoods()
  const showSkeleton = useDelayedLoading(isLoading)

  const [stockInDate, setStockInDate] = useState(localToday)
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")
  const [lines, setLines] = useState<Record<number, Line>>({})

  // One row per stock item: a whole food when its sizes share one stock
  // (Beer), a single size when it has its own (Coke 1L, Coke 1.5L).
  const rows = useMemo(() => {
    const byIngredient = new Map<number, GoodsRow>()
    for (const { food, items } of menuFoods) {
      const holdersByLink = new Map<number, typeof items>()
      for (const item of items) {
        const link = liveLink(item, ingredientById)
        if (link !== null) holdersByLink.set(link, [...(holdersByLink.get(link) ?? []), item])
      }
      for (const [ingredientId, holders] of holdersByLink) {
        const ingredient = ingredientById.get(ingredientId)!
        // Stock-ins reject these, so they could only ever fail here.
        if (byIngredient.has(ingredientId) || !isTrackedIngredientType(ingredient.category.type)) continue
        const wholeFood = holders.length === items.length
        byIngredient.set(ingredientId, {
          ingredient,
          label: wholeFood ? food.name : holders.length === 1 ? foodItemLabel(food, holders[0]) : `${food.name} (${holders.map((item) => item.name).join(", ")})`,
          hint: items.length === 1 ? "Whole food" : holders.length > 1 ? `Shared by ${holders.length} sizes` : "Per size",
        })
      }
    }
    return [...byIngredient.values()]
  }, [menuFoods, ingredientById])

  const term = search.trim().toLowerCase()
  const visible = rows.filter((row) => !term || row.label.toLowerCase().includes(term) || row.ingredient.name.toLowerCase().includes(term))

  const entered = rows
    .map((row) => ({ row, quantity: Number(lines[row.ingredient.id]?.quantity), unitCost: Number(lines[row.ingredient.id]?.unitCost || 0) }))
    .filter(({ quantity, unitCost }) => quantity > 0 && unitCost >= 0)
  const total = entered.reduce((sum, { quantity, unitCost }) => sum + quantity * unitCost, 0)

  function setLine(ingredientId: number, patch: Partial<Line>) {
    setLines((current) => ({ ...current, [ingredientId]: { ...(current[ingredientId] ?? { quantity: "", unitCost: "" }), ...patch } }))
  }

  async function handleImport() {
    if (!warehouseId || entered.length === 0) return
    try {
      const stockIn = await importGoods.mutateAsync({
        warehouseId,
        stockInDate,
        remarks: note.trim() || "Imported goods",
        items: entered.map(({ row, quantity, unitCost }) => ({ ingredientId: row.ingredient.id, quantity, unitCost })),
      })
      toast.success(`Imported ${entered.length} item${entered.length === 1 ? "" : "s"} (${stockIn.stockInNo})`, {
        action: { label: "View", onClick: () => router.push(`/dashboard/inventory/stock-ins/${stockIn.id}`) },
      })
      setLines({})
      setNote("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import goods")
    }
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Import Goods</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Enter how many arrived. Foods whose sizes share one stock (like Beer) come in as one line; sizes with their own stock (like Coke 1L and 1.5L) come in separately.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/inventory/stock-tracking" />}>
          <ListChecksIcon /> Choose what&apos;s tracked
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="import-warehouse" className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={warehouseId ? String(warehouseId) : ""} onValueChange={(value) => setWarehouseChoice(value ?? "")}>
            <SelectTrigger id="import-warehouse" className="h-9 w-full">
              <SelectValue placeholder={warehouses ? "No warehouses" : "Loading…"} />
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
        <div className="space-y-1">
          <label htmlFor="import-date" className="text-xs font-medium text-muted-foreground">Date</label>
          <Input id="import-date" type="date" value={stockInDate} max={localToday()} onChange={(event) => setStockInDate(event.target.value)} className="h-9" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="import-note" className="text-xs font-medium text-muted-foreground">Supplier / bill no. (optional)</label>
          <Input id="import-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Bottlers Nepal, bill 1042" className="h-9" />
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={4} />
      ) : rows.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
          <p>Nothing is tracked yet. Tick the foods or sizes you want to count first.</p>
          <Button variant="outline" size="sm" render={<Link href="/dashboard/inventory/stock-tracking" />}>
            Open Stock Tracking
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" className="h-9 pl-8" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
            <div className="hidden grid-cols-[1fr_7rem_8rem_8rem] gap-3 border-b border-border/70 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Item</span>
              <span className="text-right">In stock</span>
              <span>Quantity</span>
              <span>Cost / unit</span>
            </div>
            <ul className="divide-y divide-border/70">
              {visible.map(({ ingredient, label, hint }) => {
                const unit = unitById.get(ingredient.baseUnitId)
                const line = lines[ingredient.id]
                return (
                  <li key={ingredient.id} className="grid grid-cols-2 items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_7rem_8rem_8rem]">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <p className="truncate font-medium">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <p className="col-span-2 text-sm text-muted-foreground tabular-nums sm:col-span-1 sm:text-right">
                      <span className="sm:hidden">In stock: </span>
                      {availableByIngredient.get(ingredient.id) ?? 0} {unit?.shortName ?? ""}
                    </p>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={line?.quantity ?? ""}
                      onChange={(event) => setLine(ingredient.id, { quantity: event.target.value })}
                      placeholder={unit ? `Qty (${unit.shortName})` : "Qty"}
                      aria-label={`Quantity of ${label}`}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={line?.unitCost ?? ""}
                      onChange={(event) => setLine(ingredient.id, { unitCost: event.target.value })}
                      placeholder="Cost"
                      aria-label={`Cost per unit of ${label}`}
                      className="h-9"
                    />
                  </li>
                )
              })}
              {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing matches.</li>}
            </ul>
          </div>
        </div>
      )}

      {entered.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm font-medium">
            {entered.length} item{entered.length === 1 ? "" : "s"} · total cost {money(total)}
          </p>
          {!canImport && <p className="text-xs text-muted-foreground">Importing needs the stock-ins manage permission.</p>}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" disabled={importGoods.isPending} onClick={() => setLines({})}>
              Clear
            </Button>
            <Button disabled={!canImport || !warehouseId || importGoods.isPending} onClick={handleImport}>
              {importGoods.isPending ? "Importing…" : "Import goods"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
