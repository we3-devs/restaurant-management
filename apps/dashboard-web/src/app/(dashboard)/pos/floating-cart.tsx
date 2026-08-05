"use client"

import { useState } from "react"
import { ShoppingCartIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useOrderItems } from "@/hooks/use-orders"
import { CartPanel } from "./cart-panel"

/**
 * Floating bubble per FRONTEND_DESIGN_SYSTEM.md's POS spec — the cart is
 * never permanently on screen; tapping the bubble opens it as a large modal.
 */
export function FloatingCart({ orderId }: { orderId: number }) {
  const [open, setOpen] = useState(false)
  const { data: items } = useOrderItems(orderId)
  const itemCount = items?.data.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Open cart"
        className="fixed right-6 bottom-6 z-30 size-16 rounded-full p-0 shadow-lg"
      >
        <ShoppingCartIcon className="size-6" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-destructive-foreground">
            {itemCount}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">Cart</DialogTitle>
          <CartPanel orderId={orderId} />
        </DialogContent>
      </Dialog>
    </>
  )
}
