"use client"

import { useState } from "react"
import { ShoppingCartIcon } from "lucide-react"

import { Button } from "@rms/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@rms/ui/dialog"
import { Skeleton } from "@rms/ui/skeleton"
import { useOrder, useOrderItems } from "@rms/api-client/hooks/use-orders"
import { CartPanel, type CartPanelView } from "./cart-panel"
import { useLocalCartContext } from "./local-cart-context"

/**
 * Floating bubble per FRONTEND_DESIGN_SYSTEM.md's POS spec — the cart is
 * never permanently on screen; tapping the bubble opens it as a large modal.
 */
export function FloatingCart({ orderId, basePath = "/operational/pos" }: { orderId: number; basePath?: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<CartPanelView>("cart")
  const { data: order } = useOrder(orderId)
  const { data: items, isLoading } = useOrderItems(orderId)
  const localCart = useLocalCartContext()
  const localCount = localCart.items.reduce((sum, item) => sum + item.quantity, 0)
  const itemCount = (items?.data.reduce((sum, item) => sum + item.quantity, 0) ?? 0) + localCount

  return (
    <>
      <Button
        onClick={() => {
          setView("cart")
          setOpen(true)
        }}
        aria-label="Open cart"
        className="fixed right-6 bottom-6 z-30 size-16 rounded-full p-0 shadow-popover"
      >
        <ShoppingCartIcon className="size-6" />
        {isLoading ? (
          <Skeleton className="absolute -top-1 -right-1 size-6 rounded-full" />
        ) : (
          itemCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-destructive-foreground">
              {itemCount}
            </span>
          )
        )}
        <span className="sr-only">{itemCount} item(s) in cart</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) setView("cart")
        }}
      >
        <DialogContent
          className={`overflow-visible ${view === "payment" ? "sm:max-w-5xl lg:max-w-6xl" : "sm:max-w-2xl lg:max-w-3xl"}`}
          showCloseButton={order?.status !== "completed"}
          closeButtonClassName="top-0 -right-10 rounded-md bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90"
        >
          <div className="max-h-[92vh] min-h-[70vh] overflow-y-auto">
            <DialogTitle className="sr-only">{view === "payment" ? "Payment" : "Cart"}</DialogTitle>
            <CartPanel
              orderId={orderId}
              basePath={basePath}
              view={view}
              onOpenPayment={() => setView("payment")}
              onBackToCart={() => setView("cart")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
