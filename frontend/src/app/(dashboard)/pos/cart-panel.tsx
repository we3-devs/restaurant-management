"use client"

import { useState } from "react"
import { MinusIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddons } from "@/hooks/use-addons"
import { useFoods } from "@/hooks/use-foods"
import {
  useAddOrderItemAddon,
  useOrderItemAddons,
  useOrderItems,
  useRemoveOrderItem,
  useRemoveOrderItemAddon,
  useUpdateOrderItem,
  type OrderItem,
} from "@/hooks/use-orders"
import { CheckoutPanel } from "./checkout-panel"

export function CartPanel({ orderId }: { orderId: number }) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: foods } = useFoods({ limit: 100 })

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`

  return (
    <div className="flex w-96 shrink-0 flex-col gap-3 border-l border-input pl-3">
      <h2 className="text-sm font-semibold">Cart</h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {!isLoading && (items?.data.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No items yet — tap a food to add it.</p>
        )}
        {items?.data.map((item) => (
          <CartItemRow key={item.id} orderId={orderId} item={item} foodName={foodName(item.foodId)} />
        ))}
      </div>
      <CheckoutPanel orderId={orderId} />
    </div>
  )
}

function CartItemRow({ orderId, item, foodName }: { orderId: number; item: OrderItem; foodName: string }) {
  const { data: addonLinks } = useOrderItemAddons(orderId, item.id)
  const { data: addons } = useAddons({ limit: 100 })
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const addAddon = useAddOrderItemAddon(orderId, item.id)
  const removeAddon = useRemoveOrderItemAddon(orderId, item.id)
  const [note, setNote] = useState(item.note ?? "")
  const [selectedAddonId, setSelectedAddonId] = useState("")

  const addonName = (addonId: number) => addons?.data.find((a) => a.id === addonId)?.name ?? `#${addonId}`

  async function handleQuantity(delta: number) {
    const quantity = Math.max(1, item.quantity + delta)
    try {
      await updateItem.mutateAsync({ quantity })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quantity")
    }
  }

  async function handleNoteBlur() {
    if (note === (item.note ?? "")) return
    try {
      await updateItem.mutateAsync({ note })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note")
    }
  }

  async function handleRemove() {
    try {
      await removeItem.mutateAsync(item.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove item")
    }
  }

  async function handleAddAddon() {
    if (!selectedAddonId) return
    try {
      await addAddon.mutateAsync({ addonId: Number(selectedAddonId), quantity: 1 })
      setSelectedAddonId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add addon")
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{foodName}</p>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {item.totalAmount}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label="Remove item">
          <XIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(-1)} aria-label="Decrease quantity">
          <MinusIcon />
        </Button>
        <span className="w-6 text-center text-sm">{item.quantity}</span>
        <Button variant="outline" size="icon-xs" onClick={() => handleQuantity(1)} aria-label="Increase quantity">
          <PlusIcon />
        </Button>
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleNoteBlur}
        placeholder="Special instructions..."
        className="text-xs"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {(addonLinks ?? []).map((link) => (
          <div key={link.id} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {addonName(link.addonId)}
            </Badge>
            <button
              type="button"
              onClick={() => removeAddon.mutateAsync(link.addonId)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </div>
        ))}
        <Select value={selectedAddonId} onValueChange={(value) => setSelectedAddonId(value ?? "")}>
          <SelectTrigger className="h-6 w-28 text-xs">
            <SelectValue placeholder="+ addon" />
          </SelectTrigger>
          <SelectContent>
            {addons?.data.map((addon) => (
              <SelectItem key={addon.id} value={String(addon.id)}>
                {addon.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAddonId && (
          <Button variant="ghost" size="icon-xs" onClick={handleAddAddon} aria-label="Confirm add addon">
            <PlusIcon />
          </Button>
        )}
      </div>
    </div>
  )
}
