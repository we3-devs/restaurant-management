"use client"

import { useState } from "react"
import { FlameIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Skeleton } from "@rms/ui/skeleton"
import { useAddons } from "@rms/api-client/hooks/use-addons"
import { useFoods } from "@rms/api-client/hooks/use-foods"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import {
  useAddOrderItemAddon,
  useAddOrderItemsBatch,
  useFireHeldItems,
  useOrderItems,
  useRemoveOrderItem,
  useRemoveOrderItemAddon,
  useSendOrderToKitchen,
  useUpdateOrderItem,
  type OrderItem,
} from "@rms/api-client/hooks/use-orders"
import { CheckoutPanel } from "./checkout-panel"
import { useLocalCartContext } from "./local-cart-context"
import type { LocalCartItem } from "./use-local-cart"

const ITEM_STATUS_LABELS: Record<string, string> = {
  sent_to_kitchen: "Sent",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
}

export function CartPanel({ orderId }: { orderId: number }) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { data: foods } = useFoods({ limit: 100 })
  const { data: addonsList } = useAddons({ limit: 100 })
  const localCart = useLocalCartContext()
  const addItemsBatch = useAddOrderItemsBatch(orderId)
  const sendToKitchen = useSendOrderToKitchen(orderId)
  const fireHeld = useFireHeldItems(orderId)
  const isOnline = useOnlineStatus()

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`
  const serverPendingItems = items?.data.filter((item) => item.status === "stock_reserved") ?? []
  const serverPendingCount = serverPendingItems.filter((item) => !item.isHeld).length
  const heldCount = serverPendingItems.filter((item) => item.isHeld).length
  const pendingCount = serverPendingCount + localCart.items.length
  const isPlacing = addItemsBatch.isPending || sendToKitchen.isPending

  async function handlePlaceOrder() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to place the order")
      return
    }
    try {
      // Local cart items only ever touch the network here, as one batch
      // request, instead of one round-trip per add — see
      // orders.service#addItemsBatch.
      if (localCart.items.length > 0) {
        await addItemsBatch.mutateAsync({
          items: localCart.items.map((item) => ({
            foodId: item.foodId,
            foodVariantId: item.foodVariantId ?? undefined,
            quantity: item.quantity,
            note: item.note || undefined,
            addons: item.addons.map((addon) => ({ addonId: addon.addonId, quantity: addon.quantity })),
          })),
        })
        localCart.clear()
      }
      await sendToKitchen.mutateAsync()
      toast.success(`Placed ${pendingCount} item(s) — kitchen items sent to prep, the rest go straight to the waiter`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place order")
    }
  }

  async function handleFireHeld() {
    if (!isOnline) {
      toast.error("You're offline — reconnect to send items to the kitchen")
      return
    }
    try {
      await fireHeld.mutateAsync()
      toast.success(`Fired ${heldCount} held item(s) to the kitchen`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fire held items")
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-sm font-semibold">Cart</h2>
      <div className="max-h-[45vh] space-y-2 overflow-y-auto">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {!isLoading && (items?.data.length ?? 0) === 0 && localCart.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No items yet — tap a food to add it.</p>
        )}
        {localCart.items.map((item) => (
          <LocalCartItemRow key={item.localId} item={item} addonsList={addonsList?.data ?? []} />
        ))}
        {items?.data.map((item) => (
          <CartItemRow key={item.id} orderId={orderId} item={item} foodName={foodName(item.foodId)} />
        ))}
      </div>
      {heldCount > 0 && (
        <Button
          variant="outline"
          className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          onClick={handleFireHeld}
          disabled={fireHeld.isPending || !isOnline}
        >
          <FlameIcon />
          {fireHeld.isPending ? "Firing..." : `Fire held items (${heldCount})`}
        </Button>
      )}
      <Button
        variant="secondary"
        onClick={handlePlaceOrder}
        disabled={pendingCount === 0 || isPlacing || !isOnline}
      >
        {isPlacing ? "Placing..." : `Place order${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
      </Button>
      <CheckoutPanel orderId={orderId} />
    </div>
  )
}

function CartItemRow({ orderId, item, foodName }: { orderId: number; item: OrderItem; foodName: string }) {
  const { data: addons } = useAddons({ limit: 100 })
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const addAddon = useAddOrderItemAddon(orderId, item.id)
  const removeAddon = useRemoveOrderItemAddon(orderId, item.id)
  const isOnline = useOnlineStatus()
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
    if (!isOnline) {
      toast.error("You're offline — reconnect to add addons")
      return
    }
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
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">{foodName}</p>
            {item.status === "stock_reserved" && item.isHeld ? (
              <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-700 dark:text-amber-400">
                Held
              </Badge>
            ) : item.status !== "stock_reserved" ? (
              <Badge variant="secondary" className="text-xs">
                {ITEM_STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {item.totalAmount}
          </p>
        </div>
        {item.status === "stock_reserved" && (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={updateItem.isPending}
            onClick={() =>
              updateItem.mutateAsync({ isHeld: !item.isHeld }).catch((error) => {
                toast.error(error instanceof Error ? error.message : "Failed to update item")
              })
            }
            aria-label={item.isHeld ? "Fire this item now" : "Hold this item"}
            title={item.isHeld ? "Fire now (send to kitchen)" : "Hold (don't send yet)"}
          >
            {item.isHeld ? <PlayIcon className="text-emerald-500" /> : <PauseIcon className="text-amber-500" />}
          </Button>
        )}
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
        {item.addons.map((link) => (
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

/** Not-yet-placed item — every edit here is local state, nothing hits the network until "Place order". */
function LocalCartItemRow({
  item,
  addonsList,
}: {
  item: LocalCartItem
  addonsList: { id: number; name: string; price: number }[]
}) {
  const localCart = useLocalCartContext()
  const [selectedAddonId, setSelectedAddonId] = useState("")

  function handleAddAddon() {
    if (!selectedAddonId) return
    const addon = addonsList.find((a) => a.id === Number(selectedAddonId))
    if (!addon) return
    localCart.addAddon(item.localId, { addonId: addon.id, addonName: addon.name, quantity: 1, unitPrice: addon.price })
    setSelectedAddonId("")
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">
              {item.foodName}
              {item.variantName ? ` — ${item.variantName}` : ""}
            </p>
            <Badge variant="outline" className="text-xs">
              Not sent
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.unitPrice} each &middot; total {(item.unitPrice * item.quantity).toFixed(2)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => localCart.removeItem(item.localId)}
          aria-label="Remove item"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => localCart.updateQuantity(item.localId, item.quantity - 1)}
          aria-label="Decrease quantity"
        >
          <MinusIcon />
        </Button>
        <span className="w-6 text-center text-sm">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => localCart.updateQuantity(item.localId, item.quantity + 1)}
          aria-label="Increase quantity"
        >
          <PlusIcon />
        </Button>
      </div>

      <Input
        value={item.note}
        onChange={(e) => localCart.updateNote(item.localId, e.target.value)}
        placeholder="Special instructions..."
        className="text-xs"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {item.addons.map((addon) => (
          <div key={addon.addonId} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {addon.addonName}
            </Badge>
            <button
              type="button"
              onClick={() => localCart.removeAddon(item.localId, addon.addonId)}
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
            {addonsList.map((addon) => (
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
