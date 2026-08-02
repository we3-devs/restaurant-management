"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicFoodVariants, type PublicFood, type PublicFoodVariant } from "@/hooks/use-guest-menu"

export function GuestVariantPicker({
  food,
  onPick,
  onClose,
}: {
  food: PublicFood
  onPick: (variant: PublicFoodVariant) => void
  onClose: () => void
}) {
  const { data: variants, isLoading } = usePublicFoodVariants(food.id)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{food.name} — choose an option</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && (variants?.data.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No options configured for this item.</p>
          )}
          {variants?.data.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                onPick(variant)
                onClose()
              }}
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
