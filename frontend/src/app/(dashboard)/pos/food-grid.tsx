"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAddOrderItem } from "@/hooks/use-orders"
import { useFoods, type Food } from "@/hooks/use-foods"
import { VariantPickerDialog } from "./variant-picker-dialog"

const ROW_HEIGHT = 96
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
  preparationDepartmentId,
}: {
  orderId: number
  categoryId: number | null
  preparationDepartmentId: number | null
}) {
  const [search, setSearch] = useState("")
  const [variantFood, setVariantFood] = useState<Food | null>(null)
  const { data: foods, isLoading } = useFoods({
    search: search || undefined,
    foodCategoryId: categoryId ?? undefined,
    limit: 60,
  })
  const addItem = useAddOrderItem(orderId)

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
    if (food.hasVariants) {
      setVariantFood(food)
      return
    }
    try {
      await addItem.mutateAsync({
        foodId: food.id,
        preparationDepartmentId: preparationDepartmentId ?? undefined,
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
                    className="h-full cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handleAdd(food)}
                  >
                    <CardContent className="space-y-1 p-3">
                      <p className="text-sm font-medium">{food.name}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{food.basePrice}</span>
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
          preparationDepartmentId={preparationDepartmentId}
          onClose={() => setVariantFood(null)}
        />
      )}
    </div>
  )
}
