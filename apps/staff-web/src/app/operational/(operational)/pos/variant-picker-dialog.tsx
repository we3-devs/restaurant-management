"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@rms/ui/dialog"
import { Badge } from "@rms/ui/badge"
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
          {variants.map((variant) => {
            // Each food item tracks its own stock now, so one out-of-stock
            // variant (e.g. a Large drink) no longer blocks its siblings.
            const outOfStock = variant.inventoryAvailable === false
            return (
              <button
                key={variant.id}
                type="button"
                disabled={outOfStock}
                onClick={() => onPick(variant)}
                className="flex w-full items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <span>{variant.name}</span>
                <span className="flex items-center gap-2">
                  {outOfStock && <Badge variant="destructive" className="text-xs">out of stock</Badge>}
                  <span className="text-muted-foreground">{variant.price}</span>
                </span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
