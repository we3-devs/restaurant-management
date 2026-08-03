"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useKitchenRealtime } from "@/hooks/use-kitchen-realtime"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePosBootstrap } from "@/hooks/use-bootstrap"
import { useOrderDeepLink } from "@/features/waiter/use-order-deep-link"
import { FloorBoard } from "@/app/(dashboard)/floor/floor-board"
import { CategoryTabs } from "@/app/(dashboard)/pos/category-tabs"
import { FloatingCart } from "@/app/(dashboard)/pos/floating-cart"
import { FoodGrid } from "@/app/(dashboard)/pos/food-grid"
import { StartSaleDialog } from "@/app/(dashboard)/pos/start-sale-dialog"
import { TableOrdersDialog } from "@/app/(dashboard)/pos/table-orders-dialog"

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

  useKitchenRealtime(effectiveOutletId)
  usePosBootstrap(effectiveOutletId)

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
            <StartSaleDialog
              outletId={effectiveOutletId}
              onSaleStarted={(orderId) => router.push(`${BASE_PATH}?orderId=${orderId}`)}
              preselectedTableId={preselectedTableId}
            />
          )
        )}
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : isResolvingTableDeepLink ? (
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-64 w-full max-w-md" />
        </div>
      ) : !activeOrderId ? (
        <div className="flex-1 overflow-y-auto">
          <FloorBoard outletId={effectiveOutletId} basePath={BASE_PATH} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <CategoryTabs categoryId={categoryId} onSelect={setCategoryId} />
          <FoodGrid orderId={activeOrderId} categoryId={categoryId} />
          <FloatingCart orderId={activeOrderId} />
        </div>
      )}

      {needsOrderChooser && deepLinkSession && effectiveOutletId && (
        <TableOrdersDialog
          open
          onOpenChange={(open) => {
            if (!open) setChooserDismissedForTableId(Number(deepLinkTableId))
          }}
          tableName={deepLinkTableForChooser?.name ?? `Table #${deepLinkTableId}`}
          tableSessionId={deepLinkSession.id}
          outletId={effectiveOutletId}
          orders={openOrdersForDeepLinkSession}
          onSelectOrder={(orderId) => router.replace(`${BASE_PATH}?orderId=${orderId}`)}
        />
      )}
    </div>
  )
}
