"use client"

import { useState } from "react"
import { FlameIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Input } from "@rms/ui/input"
import { Separator } from "@rms/ui/separator"
import { ListSkeleton } from "@rms/ui/skeletons"
import { useFoods } from "@rms/api-client/hooks/use-foods"
import { useFoodVariants } from "@rms/api-client/hooks/use-food-variants"
import { useOnlineStatus } from "@rms/api-client/offline/online-status"
import { useOrderPayments } from "@rms/api-client/hooks/use-order-payments"
import {
  useAddOrderItemsBatch,
  useFireHeldItems,
  useOrder,
  useOrderItems,
  useRemoveOrderItem,
  useSendOrderToKitchen,
  useUpdateOrderItem,
  type OrderItem,
} from "@rms/api-client/hooks/use-orders"
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
  const { data: variants } = useFoodVariants({ limit: 100 })
  const { data: order } = useOrder(orderId)
  const { data: payments } = useOrderPayments(orderId)
  const localCart = useLocalCartContext()
  const addItemsBatch = useAddOrderItemsBatch(orderId)
  const sendToKitchen = useSendOrderToKitchen(orderId)
  const fireHeld = useFireHeldItems(orderId)
  const isOnline = useOnlineStatus()

  const foodName = (foodId: number) => foods?.data.find((f) => f.id === foodId)?.name ?? `#${foodId}`
  const variantName = (foodVariantId: number | null) =>
    foodVariantId ? (variants?.data.find((v) => v.id === foodVariantId)?.name ?? null) : null
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
        {isLoading && <ListSkeleton count={3} />}
        {!isLoading && (items?.data.length ?? 0) === 0 && localCart.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No items yet — tap a food to add it.</p>
        )}
        {localCart.items.map((item) => (
          <LocalCartItemRow key={item.localId} item={item} />
        ))}
        {items?.data.map((item) => (
          <CartItemRow
            key={item.id}
            orderId={orderId}
            item={item}
            foodName={foodName(item.foodId)}
            variantName={variantName(item.foodVariantId)}
          />
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
      {order && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Payment info</h3>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-right">{order.subtotal}</span>
              <span className="text-muted-foreground">Discount</span>
              <span className="text-right">{order.discountAmount}</span>
              <span className="text-muted-foreground">Tax</span>
              <span className="text-right">{order.taxAmount}</span>
              <span className="text-muted-foreground">Service charge</span>
              <span className="text-right">{order.serviceChargeAmount}</span>
              <span className="font-medium">Grand total</span>
              <span className="text-right font-medium">{order.grandTotal}</span>
              <span className="text-muted-foreground">Paid</span>
              <span className="text-right">{order.paidAmount}</span>
              <span className="font-medium">Due</span>
              <span className="text-right font-medium">{order.dueAmount}</span>
            </div>
            {(payments?.data.length ?? 0) > 0 && (
              <div className="space-y-1 pt-1">
                {payments?.data.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>{payment.type}</Badge>
                      <span>{payment.method}</span>
                    </div>
                    <span>{payment.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CartItemRow({
  orderId,
  item,
  foodName,
  variantName,
}: {
  orderId: number
  item: OrderItem
  foodName: string
  variantName: string | null
}) {
  const updateItem = useUpdateOrderItem(orderId, item.id)
  const removeItem = useRemoveOrderItem(orderId)
  const [note, setNote] = useState(item.note ?? "")

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

  const isServed = item.status === "served"

  return (
    <div className="space-y-2 rounded-lg border border-input p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">
              {foodName}
              {variantName ? ` — ${variantName}` : ""}
            </p>
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
        {!isServed && (
          <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label="Remove item">
            <XIcon />
          </Button>
        )}
      </div>

      {isServed ? (
        item.note && (
          <p className="text-xs text-muted-foreground">
            Qty {item.quantity} &middot; {item.note}
          </p>
        )
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

/** Not-yet-placed item — every edit here is local state, nothing hits the network until "Place order". */
function LocalCartItemRow({ item }: { item: LocalCartItem }) {
  const localCart = useLocalCartContext()

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
    </div>
  )
}
