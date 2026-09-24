"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "./button"
import { Input } from "./input"
import { useOrder, useUpdateOrder } from "@rms/api-client/hooks/use-orders"

/**
 * The one "give this order a discount" control — self-contained (loads and
 * mutates its own order by id) so it can drop into the per-order checkout
 * panel and the combined table-checkout view alike without either one
 * having to thread order state or a mutation down to it. Flat amount only —
 * percentage discounts aren't offered here.
 */
export function OrderDiscountForm({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)
  const updateOrder = useUpdateOrder(orderId)

  // Raw text, not a number: type="text" (not "number") so there's no
  // increment/decrement spinner and the field can be genuinely empty while
  // the staff member is mid-edit, without snapping back to a number.
  const [discountValue, setDiscountValue] = useState("0")
  const parsedDiscountValue = Number(discountValue)
  // Unlike a payment amount, 0 is a legitimate, submittable value here (it
  // clears an existing discount) — only a blank/invalid field blocks Apply.
  const isValidDiscountValue = discountValue.trim() !== "" && Number.isFinite(parsedDiscountValue) && parsedDiscountValue >= 0

  // Re-seed the editable field whenever a different order loads — without
  // an effect, per React's "adjusting state when a prop changes" pattern.
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  if (order && order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountValue(String(order.discountType === "flat" ? order.discountValue : 0))
  }

  if (!order) return null

  async function handleApply() {
    if (!isValidDiscountValue) return
    try {
      await updateOrder.mutateAsync({
        discountType: parsedDiscountValue > 0 ? "flat" : undefined,
        discountValue: parsedDiscountValue,
      })
      toast.success("Discount applied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply discount")
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="text"
        inputMode="decimal"
        value={discountValue}
        onChange={(e) => {
          const next = e.target.value
          if (/^\d*\.?\d*$/.test(next)) setDiscountValue(next)
        }}
        placeholder="Discount amount"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleApply}
        disabled={updateOrder.isPending || !isValidDiscountValue}
      >
        {updateOrder.isPending ? "Saving..." : "Apply discount"}
      </Button>
    </div>
  )
}
