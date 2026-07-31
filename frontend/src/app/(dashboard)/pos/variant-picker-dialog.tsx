"use client"

import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddOrderItem } from "@/hooks/use-orders"
import { useFoodVariants } from "@/hooks/use-food-variants"
import type { Food } from "@/hooks/use-foods"

export function VariantPickerDialog({
  food,
  orderId,
  preparationDepartmentId,
  onClose,
}: {
  food: Food
  orderId: number
  preparationDepartmentId: number | null
  onClose: () => void
}) {
  const { data: variants, isLoading } = useFoodVariants({ foodId: food.id, limit: 100 })
  const addItem = useAddOrderItem(orderId)

  async function handlePick(foodVariantId: number) {
    try {
      await addItem.mutateAsync({
        foodId: food.id,
        foodVariantId,
        preparationDepartmentId: preparationDepartmentId ?? undefined,
        quantity: 1,
      })
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{food.name} — choose a variant</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && (variants?.data.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No variants configured for this food.</p>
          )}
          {variants?.data.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => handlePick(variant.id)}
              disabled={addItem.isPending}
              className="flex w-full items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>{variant.name}</span>
              <span className="text-muted-foreground">{variant.price}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
