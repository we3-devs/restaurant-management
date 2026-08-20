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
import { FloorBoard } from "@/app/(operational)/floor/floor-board"
import { CategoryTabs } from "@/app/(operational)/pos/category-tabs"
import { FloatingCart } from "@/app/(operational)/pos/floating-cart"
import { FoodGrid } from "@/app/(operational)/pos/food-grid"
import { LocalCartProvider } from "@/app/(operational)/pos/local-cart-context"
import { StartSaleDialog } from "@/app/(operational)/pos/start-sale-dialog"
import { TableOrdersDialog } from "@/app/(operational)/pos/table-orders-dialog"

const BASE_PATH = "/staff/waiter/pos"

/**
 * Mobile counterpart to (dashboard)/pos — same deep-link resolution
 * (useOrderDeepLink), same table board / category tabs / food grid / cart
 * components, just without the desktop-only OrderSwitcher and sized for the
 * staff shell instead of the dashboard header offset.
 */
export default function StaffOrderTakingPage() {
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
  } = useOrderDeepLink({ basePath: BASE_PATH, outletId, deepLinkOrderId, deepLinkTableId })

  // A cancelled order can still be reached via a deep link (order switcher,
  // stale browser history, a notification) — treat it as gone rather than
  // rendering the live cart, which would let staff keep adding items to it.
  const { data: activeOrder } = useOrder(activeOrderId ?? 0)
  const isCancelledOrder = activeOrder?.status === "cancelled"

  useKitchenRealtime(effectiveOutletId)
  const bootstrap = usePosBootstrap(effectiveOutletId)

  // Lazy: StartSaleDialog (and its table-sessions/customers requests) isn't
  // mounted until the button below is tapped or preselectedTableId forces it
  // open — see useStartSaleDialogState.
  const startSale = useStartSaleDialogState(preselectedTableId)

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">
          {activeOrderId ? "Order" : "Tables"}
        </h1>
        {activeOrderId ? (
          <Button variant="outline" size="sm" onClick={() => router.push(BASE_PATH)}>
            New sale
          </Button>
        ) : (
          effectiveOutletId &&
          !isResolvingTableDeepLink && (
            <Button size="sm" onClick={startSale.openDialog}>
              Start sale
            </Button>
          )
        )}
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : isResolvingTableDeepLink ? (
        <div className="flex flex-1 items-center justify-center">
          <CardGridSkeleton count={4} columns={2} className="w-full max-w-md" />
        </div>
      ) : !activeOrderId ? (
        <div className="flex-1 overflow-y-auto">
          <FloorBoard outletId={effectiveOutletId} basePath={BASE_PATH} />
        </div>
      ) : isCancelledOrder ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium">This order was cancelled</p>
          <p className="text-sm text-muted-foreground">It can no longer be edited.</p>
          <Button onClick={() => router.push(BASE_PATH)}>Back to tables</Button>
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
          onSelectOrder={(orderId) => router.replace(`${BASE_PATH}?orderId=${orderId}`)}
        />
      )}

      {startSale.mounted && effectiveOutletId && (
        <StartSaleDialog
          open={startSale.open}
          onOpenChange={startSale.onOpenChange}
          outletId={effectiveOutletId}
          onSaleStarted={(orderId) => router.push(`${BASE_PATH}?orderId=${orderId}`)}
          preselectedTableId={preselectedTableId}
          tables={bootstrap.data?.tables ?? []}
        />
      )}
    </div>
  )
}
