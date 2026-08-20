"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@rms/ui/button"
import { CardGridSkeleton } from "@rms/ui/skeletons"
import { useKitchenRealtime } from "@rms/api-client/hooks/use-kitchen-realtime"
import { useOrder } from "@rms/api-client/hooks/use-orders"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { usePosBootstrap } from "@rms/api-client/hooks/use-bootstrap"
import { useOrderDeepLink } from "@/features/waiter/use-order-deep-link"
import { useStartSaleDialogState } from "@/features/waiter/use-start-sale-dialog"
import { FloorBoard } from "../floor/floor-board"
import { CategoryTabs } from "./category-tabs"
import { FloatingCart } from "./floating-cart"
import { FoodGrid } from "./food-grid"
import { LocalCartProvider } from "./local-cart-context"
import { OrderSwitcher } from "./order-switcher"
import { StartSaleDialog } from "./start-sale-dialog"
import { TableOrdersDialog } from "./table-orders-dialog"

export default function PosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get("orderId")
  const deepLinkTableId = searchParams.get("tableId")
  const { outletId } = useActiveOutlet()
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const {
    activeOrderId,
    effectiveOutletId,
    isResolvingTableDeepLink,
    preselectedTableId,
    needsOrderChooser,
    deepLinkSession,
    deepLinkTableForChooser,
    openOrdersForDeepLinkSession,
    setChooserDismissedForTableId,
  } = useOrderDeepLink({ basePath: "/pos", outletId, deepLinkOrderId, deepLinkTableId })

  // A cancelled order can still be reached via a deep link (order switcher,
  // stale browser history, a notification) — treat it as gone rather than
  // rendering the live cart, which would let staff keep adding items to it.
  const { data: activeOrder } = useOrder(activeOrderId ?? 0)
  const isCancelledOrder = activeOrder?.status === "cancelled"

  // Keep the cart's item status badges live as the kitchen advances items
  // (Sent -> Preparing -> Ready) — same KDS socket the /kitchen board uses.
  useKitchenRealtime(effectiveOutletId)

  // One request for tables + food categories + addons instead of three; it
  // also seeds the caches those hooks below read from.
  const bootstrap = usePosBootstrap(effectiveOutletId)

  // Lazy: StartSaleDialog (and its table-sessions/customers requests) isn't
  // mounted until the button below is tapped or preselectedTableId forces it
  // open — see useStartSaleDialogState.
  const startSale = useStartSaleDialogState(preselectedTableId)

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">POS</h1>
        <div className="flex items-center gap-2">
          {effectiveOutletId && <OrderSwitcher outletId={effectiveOutletId} activeOrderId={activeOrderId} />}
          {activeOrderId ? (
            <Button variant="outline" onClick={() => router.push("/pos")}>
              New sale
            </Button>
          ) : (
            effectiveOutletId &&
            !isResolvingTableDeepLink && (
              // Only needed for grab-and-go/stay/delivery, or picking a table
              // without leaving this page — starting a table sale normally
              // happens by tapping a table below.
              <Button size="lg" onClick={startSale.openDialog}>
                Start sale
              </Button>
            )
          )}
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : isResolvingTableDeepLink ? (
        <div className="flex flex-1 items-center justify-center">
          <CardGridSkeleton count={4} columns={2} className="w-full max-w-md" />
        </div>
      ) : !activeOrderId ? (
        // No table/order picked yet — the floor plan doubles as the "start or
        // continue a sale" screen so there's no separate stop at /floor first.
        <div className="flex-1 overflow-y-auto">
          <FloorBoard outletId={effectiveOutletId} />
        </div>
      ) : isCancelledOrder ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium">This order was cancelled</p>
          <p className="text-sm text-muted-foreground">It can no longer be edited.</p>
          <Button onClick={() => router.push("/pos")}>Back to floor</Button>
        </div>
      ) : (
        <LocalCartProvider orderId={activeOrderId}>
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <CategoryTabs categoryId={categoryId} onSelect={setCategoryId} />
            <FoodGrid categoryId={categoryId} />
            <FloatingCart orderId={activeOrderId} />
          </div>
        </LocalCartProvider>
      )}

      {needsOrderChooser && deepLinkSession && effectiveOutletId && (
        <TableOrdersDialog
          open
          onOpenChange={(open) => {
            if (!open) setChooserDismissedForTableId(Number(deepLinkTableId))
          }}
          tableName={deepLinkTableForChooser?.name ?? "Loading…"}
          tableSessionId={deepLinkSession.id}
          outletId={effectiveOutletId}
          orders={openOrdersForDeepLinkSession}
          onSelectOrder={(orderId) => router.replace(`/pos?orderId=${orderId}`)}
        />
      )}

      {startSale.mounted && effectiveOutletId && (
        <StartSaleDialog
          open={startSale.open}
          onOpenChange={startSale.onOpenChange}
          outletId={effectiveOutletId}
          onSaleStarted={(orderId) => router.push(`/pos?orderId=${orderId}`)}
          preselectedTableId={preselectedTableId}
          tables={bootstrap.data?.tables ?? []}
        />
      )}
    </div>
  )
}
