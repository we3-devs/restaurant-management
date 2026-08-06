"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@rms/ui/dialog"
import { Skeleton } from "@rms/ui/skeleton"
import { useFoodVariants, type FoodVariant } from "@rms/api-client/hooks/use-food-variants"
import type { Food } from "@rms/api-client/hooks/use-foods"

export function VariantPickerDialog({
  food,
  onPick,
  onClose,
}: {
  food: Food
  onPick: (variant: FoodVariant) => void
  onClose: () => void
}) {
  const { data: variants, isLoading } = useFoodVariants({ foodId: food.id, limit: 100 })

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
              onClick={() => onPick(variant)}
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
