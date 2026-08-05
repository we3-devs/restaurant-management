"use client"

import { useMemo, useState } from "react"
import { MinusIcon, PlusIcon, UtensilsIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { cn } from "@rms/ui/cn"
import { usePublicFoodCategories, usePublicFoods, type PublicFood, type PublicFoodVariant } from "@rms/api-client/hooks/use-guest-menu"
import { useSubmitGuestOrder } from "@rms/api-client/hooks/use-guest-orders"
import { GuestVariantPicker } from "./guest-variant-picker"

interface CartEntry {
  key: string
  foodId: number
  foodVariantId?: number
  label: string
  price: number
  quantity: number
}

function cartKey(foodId: number, variantId?: number) {
  return variantId ? `${foodId}:${variantId}` : String(foodId)
}

export function GuestMenu({ tableCode }: { tableCode: string }) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map())
  const [variantPickerFood, setVariantPickerFood] = useState<PublicFood | null>(null)

  const { data: categories } = usePublicFoodCategories()
  const { data: foods, isLoading } = usePublicFoods({ foodCategoryId: categoryId ?? undefined, limit: 60 })
  const submitOrder = useSubmitGuestOrder()

  const cartItems = useMemo(() => Array.from(cart.values()), [cart])
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  function adjustCart(entry: Omit<CartEntry, "quantity">, delta: number) {
    setCart((prev) => {
      const next = new Map(prev)
      const existing = next.get(entry.key)
      const quantity = (existing?.quantity ?? 0) + delta
      if (quantity <= 0) {
        next.delete(entry.key)
      } else {
        next.set(entry.key, { ...entry, quantity })
      }
      return next
    })
  }

  function handlePickVariant(food: PublicFood, variant: PublicFoodVariant) {
    adjustCart(
      {
        key: cartKey(food.id, variant.id),
        foodId: food.id,
        foodVariantId: variant.id,
        label: `${food.name} — ${variant.name}`,
        price: variant.price,
      },
      1,
    )
  }

  async function handleSubmit() {
    if (cartItems.length === 0) return
    try {
      await submitOrder.mutateAsync({
        tableCode,
        items: cartItems.map((item) => ({
          foodId: item.foodId,
          foodVariantId: item.foodVariantId,
          quantity: item.quantity,
        })),
      })
      setCart(new Map())
      toast.success("Order sent to the kitchen")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit order")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
            categoryId === null ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground",
          )}
        >
          All items
        </button>
        {categories?.data.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryId(category.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              categoryId === category.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading menu...</p>}
      {!isLoading && (foods?.data.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No items in this category.</p>
      )}

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {foods?.data.map((food) => {
          // A variant food can have several cart entries (one per chosen
          // variant) — sum them for the badge/quantity shown on the row.
          const foodCartEntries = cartItems.filter((item) => item.foodId === food.id)
          const quantity = food.hasVariants
            ? foodCartEntries.reduce((sum, item) => sum + item.quantity, 0)
            : (cart.get(cartKey(food.id))?.quantity ?? 0)

          return (
            <div key={food.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <UtensilsIcon className="size-5 text-muted-foreground/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{food.name}</p>
                {food.hasVariants ? (
                  <Badge variant="secondary" className="text-xs">
                    Choose an option
                  </Badge>
                ) : (
                  <p className="text-xs text-muted-foreground">{food.basePrice}</p>
                )}
              </div>
              {food.hasVariants ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  {quantity > 0 && <span className="text-xs text-muted-foreground">{quantity} added</span>}
                  <Button variant="outline" size="sm" onClick={() => setVariantPickerFood(food)}>
                    {quantity > 0 ? "Add more" : "Choose"}
                  </Button>
                </div>
              ) : quantity > 0 ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() =>
                      adjustCart({ key: cartKey(food.id), foodId: food.id, label: food.name, price: food.basePrice }, -1)
                    }
                  >
                    <MinusIcon />
                  </Button>
                  <span className="w-4 text-center text-sm">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() =>
                      adjustCart({ key: cartKey(food.id), foodId: food.id, label: food.name, price: food.basePrice }, 1)
                    }
                  >
                    <PlusIcon />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    adjustCart({ key: cartKey(food.id), foodId: food.id, label: food.name, price: food.basePrice }, 1)
                  }
                >
                  Add
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {cartCount > 0 && (
        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitOrder.isPending}>
          {submitOrder.isPending
            ? "Sending..."
            : `Place order — ${cartCount} item${cartCount === 1 ? "" : "s"} (${cartTotal})`}
        </Button>
      )}

      {variantPickerFood && (
        <GuestVariantPicker
          food={variantPickerFood}
          onPick={(variant) => handlePickVariant(variantPickerFood, variant)}
          onClose={() => setVariantPickerFood(null)}
        />
      )}
    </div>
  )
}
