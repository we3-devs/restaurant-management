"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { SearchIcon, UtensilsIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Card, CardContent } from "@rms/ui/card"
import { Input } from "@rms/ui/input"
import { useAddOrderItem } from "@rms/api-client/hooks/use-orders"
import { useFoods, type Food } from "@rms/api-client/hooks/use-foods"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
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

export function FoodGrid({
  orderId,
  categoryId,
}: {
  orderId: number
  categoryId: number | null
}) {
  const [search, setSearch] = useState("")
  const [variantFood, setVariantFood] = useState<Food | null>(null)
  const { data: foods, isLoading } = useFoods({
    search: search || undefined,
    foodCategoryId: categoryId ?? undefined,
    limit: 60,
  })
  const addItem = useAddOrderItem(orderId)
  const isOnline = useOnlineStatus()

  const columns = useColumnCount()
  const scrollRef = useRef<HTMLDivElement>(null)
  const items = foods?.data ?? []
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

  async function handleAdd(food: Food) {
    if (!isOnline) {
      toast.error("You're offline — reconnect to add items to the order")
      return
    }
    if (food.hasVariants) {
      setVariantFood(food)
      return
    }
    try {
      await addItem.mutateAsync({
        foodId: food.id,
        quantity: 1,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
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

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No foods found.</p>}

      {!isLoading && items.length > 0 && (
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
                    className="flex h-full cursor-pointer flex-col overflow-hidden p-0 transition-colors hover:bg-muted/50"
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
                          {food.hasVariants && (
                            <Badge variant="secondary" className="text-xs">
                              variants
                            </Badge>
                          )}
                          {food.hasAddons && (
                            <Badge variant="secondary" className="text-xs">
                              addons
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
          orderId={orderId}
          onClose={() => setVariantFood(null)}
        />
      )}
    </div>
  )
}
