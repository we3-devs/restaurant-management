"use client"

import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAddOrderItem } from "@/hooks/use-orders"
import { useFoods, type Food } from "@/hooks/use-foods"
import { VariantPickerDialog } from "./variant-picker-dialog"

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

      <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (foods?.data.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No foods found.</p>
        )}
        {foods?.data.map((food) => (
          <Card
            key={food.id}
            className="cursor-pointer transition-colors hover:bg-muted/50"
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
