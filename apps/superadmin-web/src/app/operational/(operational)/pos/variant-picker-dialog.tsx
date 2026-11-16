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
  getQuantityInCart,
  onPick,
  onClose,
}: {
  food: Food
  variants: FoodVariant[]
  getQuantityInCart: (variantId: number) => number
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
            const quantityInCart = getQuantityInCart(variant.id)
            const remaining = variant.availableQuantity == null
              ? null
              : Math.max(0, variant.availableQuantity - quantityInCart)
            const outOfStock = variant.inventoryAvailable === false || remaining === 0
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
                  {outOfStock ? (
                    <Badge variant="destructive" className="text-xs">
                      {variant.availableQuantity === 0 ? "out of stock" : "limit reached"}
                    </Badge>
                  ) : remaining !== null ? (
                    <Badge variant="outline" className="text-xs">{remaining} available</Badge>
                  ) : null}
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
