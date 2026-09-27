"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { PackagePlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useSetInventoryTracking } from "@/hooks/use-foods"
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import type { Ingredient } from "@/hooks/use-ingredients"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { cn } from "@/lib/utils"
import { isTrackedIngredientType } from "@/lib/validators/ingredient-categories"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { liveLink, useMenuStock, type MenuStockFood } from "../_shared/use-menu-stock"

interface Tracking {
  shareStock: boolean
  tracked: number[]
}

type Filter = "all" | "tracked" | "untracked"

const COUNTING_UNIT = /^(pcs?|pieces?|bottles?|units?|nos?|cans?)$/i

function savedTracking({ items }: MenuStockFood, ingredientById: Map<number, Ingredient>): Tracking {
  const links = items.map((item) => liveLink(item, ingredientById))
  const holders = new Map<number, number>()
  for (const link of links) if (link !== null) holders.set(link, (holders.get(link) ?? 0) + 1)
  return {
    shareStock: items.length === 1 || [...holders.values()].some((count) => count > 1),
    tracked: items.filter((_, index) => links[index] !== null).map((item) => item.id),
  }
}

/** Share/separate only means something once two or more sizes are tracked. */
function sameTracking(a: Tracking, b: Tracking): boolean {
  if (a.tracked.length !== b.tracked.length || a.tracked.some((id) => !b.tracked.includes(id))) return false
  return a.tracked.length <= 1 || a.shareStock === b.shareStock
}

function Segmented<T extends string | boolean>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5 text-xs">
      {options.map(([option, text]) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium transition-colors disabled:opacity-50",
            value === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export default function StockTrackingPage() {
  usePageTitle("Stock Tracking")
  const { outletId } = useActiveOutlet()
  const { permissions } = useCurrentUser()
  const canEdit = permissions.includes("foods.manage") && permissions.includes("ingredients.manage")
  const { data: warehouses } = useWarehouses({ limit: 100, outletId: outletId ?? undefined })
  const warehouse = warehouses?.data.find((candidate) => candidate.isDefault) ?? warehouses?.data[0]
  const { menuFoods, ingredientById, unitById, availableByIngredient, isLoading } = useMenuStock(warehouse?.id)
  const { data: ingredientCategories } = useIngredientCategories({ limit: 100 })
  const setTracking = useSetInventoryTracking()
  const showSkeleton = useDelayedLoading(isLoading)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [draft, setDraft] = useState<Record<number, Tracking>>({})
  const [categoryId, setCategoryId] = useState("")
  const [unitId, setUnitId] = useState("")

  const saved = useMemo(
    () => new Map(menuFoods.map((entry) => [entry.food.id, savedTracking(entry, ingredientById)])),
    [menuFoods, ingredientById],
  )
  const stockCategories = useMemo(
    () => (ingredientCategories?.data ?? []).filter((category) => category.isActive && isTrackedIngredientType(category.type)),
    [ingredientCategories],
  )
  const units = useMemo(() => [...unitById.values()].filter((unit) => unit.isActive), [unitById])
  const newItemCategoryId = categoryId || String((stockCategories.find((category) => category.type === "beverage") ?? stockCategories[0])?.id ?? "")
  const newItemUnitId = unitId || String((units.find((unit) => COUNTING_UNIT.test(unit.shortName) || COUNTING_UNIT.test(unit.name)) ?? units[0])?.id ?? "")

  const changed = menuFoods.filter((entry) => {
    const next = draft[entry.food.id]
    return next !== undefined && !sameTracking(next, saved.get(entry.food.id)!)
  })

  const term = search.trim().toLowerCase()
  const visible = menuFoods.filter((entry) => {
    const matches =
      !term ||
      entry.food.name.toLowerCase().includes(term) ||
      entry.categoryName.toLowerCase().includes(term) ||
      entry.items.some((item) => item.name.toLowerCase().includes(term))
    const isTracked = saved.get(entry.food.id)!.tracked.length > 0
    return matches && (filter === "all" || (filter === "tracked") === isTracked)
  })

  function update(foodId: number, next: Partial<Tracking>) {
    setDraft((current) => ({ ...current, [foodId]: { ...(current[foodId] ?? saved.get(foodId)!), ...next } }))
  }

  async function handleSave() {
    if (!outletId) return
    try {
      const result = await setTracking.mutateAsync({
        outletId,
        ingredientCategoryId: newItemCategoryId ? Number(newItemCategoryId) : undefined,
        baseUnitId: newItemUnitId ? Number(newItemUnitId) : undefined,
        foods: changed.map(({ food, items }) => ({
          foodId: food.id,
          shareStock: items.length === 1 || draft[food.id]!.shareStock,
          trackedFoodVariantIds: draft[food.id]!.tracked,
        })),
      })
      if (result.updated > 0) {
        const created = result.created > 0 ? ` · ${result.created} new stock item${result.created === 1 ? "" : "s"}` : ""
        toast.success(`Saved ${result.updated} food${result.updated === 1 ? "" : "s"}${created}`)
      }
      if (result.errors.length > 0) toast.error(result.errors.join("\n"))
      setDraft({})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save stock tracking")
    }
  }

  function stockBadge(ingredientId: number | null): ReactNode {
    if (ingredientId === null) return null
    const available = availableByIngredient.get(ingredientId) ?? 0
    const ingredient = ingredientById.get(ingredientId)
    const unit = ingredient ? unitById.get(ingredient.baseUnitId) : undefined
    return available > 0 ? (
      <Badge variant="success">{available} {unit?.shortName ?? ""} in stock</Badge>
    ) : (
      <Badge variant="destructive">Out of stock</Badge>
    )
  }

  function status(wasTracked: boolean, isTracked: boolean, setupChanged: boolean, ingredientId: number | null): ReactNode {
    if (isTracked && !wasTracked) return <Badge variant="info">Will track</Badge>
    if (!isTracked && wasTracked) return <Badge variant="warning">Will stop</Badge>
    if (!isTracked) return <span className="text-xs text-muted-foreground">Not tracked</span>
    if (setupChanged) return <Badge variant="info">Will update</Badge>
    return stockBadge(ingredientId)
  }

  const disabled = !canEdit || setTracking.isPending

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Stock Tracking</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tick what you want to count. Each sale then takes one off its stock automatically.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/inventory/import-goods" />}>
          <PackagePlusIcon /> Import goods
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search foods or sizes" className="h-9 pl-8" />
        </div>
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[["all", "All"], ["tracked", "Tracked"], ["untracked", "Not tracked"]]}
        />
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">You can view stock tracking, but changing it needs the foods and ingredients manage permissions.</p>
      )}

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={3} />
      ) : menuFoods.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
          No ready-made foods yet. Kitchen dishes aren&apos;t listed here — their stock comes from their recipe.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">Nothing matches.</div>
      ) : (
        <ul className="grid items-start gap-3 lg:grid-cols-2">
          {visible.map((entry) => {
            const { food, items, categoryName } = entry
            const before = saved.get(food.id)!
            const current = draft[food.id] ?? before
            const shared = items.length === 1 || current.shareStock
            const setupChanged =
              before.shareStock !== current.shareStock && (before.tracked.length > 1 || current.tracked.length > 1)
            const allTracked = current.tracked.length === items.length
            const poolLink = before.tracked.length > 0 ? liveLink(items.find((item) => item.id === before.tracked[0])!, ingredientById) : null
            const subtitle =
              items.length > 1 ? `${categoryName} · ${items.length} sizes` : items[0].name !== food.name ? `${categoryName} · ${items[0].name}` : categoryName

            return (
              <li key={food.id} className="rounded-2xl border border-border/80 bg-card shadow-sm">
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={allTracked}
                    indeterminate={current.tracked.length > 0 && !allTracked}
                    disabled={disabled}
                    onCheckedChange={(checked) => update(food.id, { tracked: checked ? items.map((item) => item.id) : [] })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{food.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                  </span>
                  {shared && status(before.tracked.length > 0, current.tracked.length > 0, setupChanged, poolLink)}
                </label>

                {items.length > 1 && (
                  <div className="space-y-2 border-t border-border/70 px-4 py-3 sm:pl-11">
                    <Segmented
                      label={`How ${food.name} sizes are counted`}
                      value={current.shareStock}
                      disabled={disabled}
                      onChange={(shareStock) => update(food.id, { shareStock })}
                      options={[[false, "Each size separately"], [true, "All sizes share one stock"]]}
                    />
                    <p className="text-xs text-muted-foreground">
                      {current.shareStock
                        ? "One stock for every ticked size — selling any of them takes one off it."
                        : "Every ticked size has its own stock, like Coke 1L and Coke 1.5L."}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((item) => {
                        const isTracked = current.tracked.includes(item.id)
                        return (
                          <li key={item.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                              <Checkbox
                                checked={isTracked}
                                disabled={disabled}
                                onCheckedChange={(checked) =>
                                  update(food.id, {
                                    tracked: checked
                                      ? items.filter((candidate) => candidate.id === item.id || current.tracked.includes(candidate.id)).map((candidate) => candidate.id)
                                      : current.tracked.filter((id) => id !== item.id),
                                  })
                                }
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                              {!shared &&
                                status(before.tracked.includes(item.id), isTracked, setupChanged, liveLink(item, ingredientById))}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {changed.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm font-medium">
            {changed.length} food{changed.length === 1 ? "" : "s"} changed
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {stockCategories.length === 0 ? (
              <span>
                New stock items need a stock category —{" "}
                <Link href="/dashboard/inventory/ingredient-categories" className="underline">
                  create one
                </Link>{" "}
                of type Beverage, Packaging or Consumable.
              </span>
            ) : (
              <>
                <span>New stock items go in</span>
                <Select value={newItemCategoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
                  <SelectTrigger className="h-8 w-36 text-xs" aria-label="Stock category for new items">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>counted in</span>
                <Select value={newItemUnitId} onValueChange={(value) => setUnitId(value ?? "")}>
                  <SelectTrigger className="h-8 w-28 text-xs" aria-label="Counting unit for new items">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={String(unit.id)}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" disabled={setTracking.isPending} onClick={() => setDraft({})}>
              Discard
            </Button>
            <Button disabled={disabled || !outletId} onClick={handleSave}>
              {setTracking.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
