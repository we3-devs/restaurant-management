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

  const [discountValue, setDiscountValue] = useState(0)

  // Re-seed the editable field whenever a different order loads — without
  // an effect, per React's "adjusting state when a prop changes" pattern.
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  if (order && order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountValue(order.discountType === "flat" ? order.discountValue : 0)
  }

  if (!order) return null

  async function handleApply() {
    try {
      await updateOrder.mutateAsync({
        discountType: discountValue > 0 ? "flat" : undefined,
        discountValue,
      })
      toast.success("Discount applied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply discount")
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="number"
        step="0.01"
        value={discountValue}
        onChange={(e) => setDiscountValue(Number(e.target.value))}
        placeholder="Discount amount"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleApply}
        disabled={updateOrder.isPending}
      >
        {updateOrder.isPending ? "Saving..." : "Apply discount"}
      </Button>
    </div>
  )
}
