"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@rms/ui/dialog"
import { type FoodVariant } from "@rms/api-client/hooks/use-food-variants"
import type { Food } from "@rms/api-client/hooks/use-foods"

export function VariantPickerDialog({
  food,
  variants,
  onPick,
  onClose,
}: {
  food: Food
  variants: FoodVariant[]
  onPick: (variant: FoodVariant) => void
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{food.name} — choose a variant</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {variants.length === 0 && (
            <p className="text-sm text-muted-foreground">No variants configured for this food.</p>
          )}
          {variants.map((variant) => (
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
