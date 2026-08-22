"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "./button"
import { Input } from "./input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { useOrder, useUpdateOrder } from "@rms/api-client/hooks/use-orders"
import { ORDER_DISCOUNT_TYPES } from "@rms/validators/orders"

/**
 * The one "give this order a discount" control — self-contained (loads and
 * mutates its own order by id) so it can drop into the per-order checkout
 * panel and the combined table-checkout view alike without either one
 * having to thread order state or a mutation down to it.
 */
export function OrderDiscountForm({ orderId }: { orderId: number }) {
  const { data: order } = useOrder(orderId)
  const updateOrder = useUpdateOrder(orderId)

  const [discountType, setDiscountType] = useState<string>("none")
  const [discountValue, setDiscountValue] = useState(0)

  // Re-seed the editable fields whenever a different order loads — without
  // an effect, per React's "adjusting state when a prop changes" pattern.
  const [seededOrderId, setSeededOrderId] = useState<number | null>(null)
  if (order && order.id !== seededOrderId) {
    setSeededOrderId(order.id)
    setDiscountType(order.discountType ?? "none")
    setDiscountValue(order.discountValue)
  }

  if (!order) return null

  async function handleApply() {
    try {
      await updateOrder.mutateAsync({
        discountType: discountType === "none" ? undefined : (discountType as "flat" | "percentage"),
        discountValue,
      })
      toast.success("Discount applied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply discount")
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={discountType} onValueChange={(value) => value && setDiscountType(value)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No discount</SelectItem>
          {ORDER_DISCOUNT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        step="0.01"
        value={discountValue}
        onChange={(e) => setDiscountValue(Number(e.target.value))}
        placeholder="Discount value"
      />
      <Button
        variant="outline"
        size="sm"
        className="col-span-2"
        onClick={handleApply}
        disabled={updateOrder.isPending}
      >
        {updateOrder.isPending ? "Saving..." : "Apply discount"}
      </Button>
    </div>
  )
}
