"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { toast } from "sonner"
import { SearchIcon, UtensilsIcon } from "lucide-react"

import { Badge } from "@rms/ui/badge"
import { Card, CardContent } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { CardGridSkeleton } from "@rms/ui/skeletons"
import { useMenu } from "@rms/api-client/hooks/use-menu"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import type { Food } from "@rms/api-client/hooks/use-foods"
import { useLocalCartContext } from "./local-cart-context"
import { VariantPickerDialog } from "./variant-picker-dialog"

const ROW_HEIGHT = 208
const ROW_GAP = 12

function useColumnCount() {
  const [columns, setColumns] = useState(2)
  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1024) setColumns(4)
      else if (window.innerWidth >= 640) setColumns(3)
      else setColumns(2)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return columns
}

export function FoodGrid({ categoryId }: { categoryId: number | null }) {
  const [search, setSearch] = useState("")
  const [variantFood, setVariantFood] = useState<Food | null>(null)
  const { outletId } = useActiveOutlet()
  const { data: menu, isLoading } = useMenu(outletId)
  const localCart = useLocalCartContext()

  const columns = useColumnCount()
  const scrollRef = useRef<HTMLDivElement>(null)
  const items = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return (menu?.foods ?? []).filter((food) =>
      (categoryId === null || food.foodCategoryId === categoryId) &&
      (!normalized || food.name.toLowerCase().includes(normalized)),
    )
  }, [menu?.foods, search, categoryId])
  const rows = useMemo(() => {
    const chunked: Food[][] = []
    for (let i = 0; i < items.length; i += columns) {
      chunked.push(items.slice(i, i + columns))
    }
    return chunked
  }, [items, columns])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 4,
  })

  // Cart-building is entirely local/offline — the order only ever hits the
  // network once, in a single batch, when "Place order" is tapped.
  function handleAdd(food: Food) {
    if (food.inventoryAvailable === false) {
      toast.error(`${food.name} is out of stock`, { duration: 1600 })
      return
    }
    if (food.hasVariants) {
      setVariantFood(food)
      return
    }
    localCart.addItem({
      foodId: food.id,
      foodName: food.name,
      foodVariantId: null,
      variantName: null,
      unitPrice: food.basePrice,
    })
    toast.success(`${food.name} added to cart`, { duration: 1200 })
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search food..."
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <CardGridSkeleton count={12} columns={columns} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No foods found.</p>
      ) : (
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 grid w-full gap-3"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rows[virtualRow.index].map((food) => (
                  <Card
                    key={food.id}
                    className={`flex h-full flex-col overflow-hidden p-0 transition-colors ${food.inventoryAvailable === false ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                    onClick={() => handleAdd(food)}
                  >
                    <div className="flex h-24 shrink-0 items-center justify-center bg-muted">
                      <UtensilsIcon className="size-8 text-muted-foreground/50" />
                    </div>
                    <CardContent className="flex flex-1 flex-col gap-1 p-3">
                      <p className="text-sm font-medium">{food.name}</p>
                      {food.shortDescription && (
                        <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">
                          {food.shortDescription}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1">
                        {food.hasVariants ? (
                          <span className="text-xs text-muted-foreground">Choose variant</span>
                        ) : (
                          <span className="text-sm font-medium">{food.basePrice}</span>
                        )}
                        <div className="flex gap-1">
                          {food.inventoryAvailable === false && <Badge variant="destructive" className="text-xs">out of stock</Badge>}
                          {food.hasVariants && (
                            <Badge variant="secondary" className="text-xs">
                              variants
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {variantFood && (
        <VariantPickerDialog
          food={variantFood}
          variants={menu?.foodVariants.filter((variant) => variant.foodId === variantFood.id) ?? []}
          onPick={(variant) => {
            localCart.addItem({
              foodId: variantFood.id,
              foodName: variantFood.name,
              foodVariantId: variant.id,
              variantName: variant.name,
              unitPrice: variant.price,
            })
            toast.success(`${variantFood.name} added to cart`, { duration: 1200 })
            setVariantFood(null)
          }}
          onClose={() => setVariantFood(null)}
        />
      )}
    </div>
  )
}
