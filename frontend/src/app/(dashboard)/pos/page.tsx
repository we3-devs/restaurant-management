"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrder, useOrders } from "@/hooks/use-orders"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useKitchenRealtime } from "@/hooks/use-kitchen-realtime"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePosBootstrap } from "@/hooks/use-bootstrap"
import { useDiningTable } from "@/hooks/use-dining-tables"
import { FloorBoard } from "../floor/floor-board"
import { CategoryTabs } from "./category-tabs"
import { FloatingCart } from "./floating-cart"
import { FoodGrid } from "./food-grid"
import { OrderSwitcher } from "./order-switcher"
import { StartSaleDialog } from "./start-sale-dialog"
import { TableOrdersDialog } from "./table-orders-dialog"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

export default function PosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get("orderId")
  const deepLinkTableId = searchParams.get("tableId")
  const { outletId } = useActiveOutlet()
  const [activeOrderId, setActiveOrderId] = useState<number | null>(
    deepLinkOrderId ? Number(deepLinkOrderId) : null,
  )
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [chooserDismissedForTableId, setChooserDismissedForTableId] = useState<number | null>(null)
  const { data: deepLinkOrder } = useOrder(activeOrderId && deepLinkOrderId ? activeOrderId : 0)

  // The URL (?orderId=) is the single source of truth for which sale is
  // showing — every transition (switcher pick, "New sale", browser
  // back/forward) goes through router.push/replace, and this effect mirrors
  // it back into local state. That's what makes the browser's native
  // back/forward buttons work for moving between sales, with no custom
  // "back to last one" button needed.
  useEffect(() => {
    setActiveOrderId(deepLinkOrderId ? Number(deepLinkOrderId) : null)
  }, [deepLinkOrderId])

  // Arriving via a table-card click on /floor (?tableId=...) — resolve
  // whether that table already has an active session, and how many open
  // orders (not completed/cancelled) it's carrying. A table session can now
  // carry more than one at once (a guest QR order alongside a staff POS
  // order, or two POS rounds rung up separately): exactly one -> jump
  // straight into it, same as the ?orderId= deep link above; zero or
  // several -> TableOrdersDialog below lets staff pick one or start another
  // instead of silently landing on whichever happens to be most recent.
  const resolvingTable = !activeOrderId && !deepLinkOrderId && !!deepLinkTableId
  const { data: tableSessionsForDeepLink, isLoading: isLoadingTableSession } = useTableSessions({
    diningTableId: resolvingTable ? Number(deepLinkTableId) : -1,
    status: "active",
    limit: 1,
  })
  const deepLinkSession = tableSessionsForDeepLink?.data[0]
  const { data: ordersForDeepLinkSession, isLoading: isLoadingSessionOrder } = useOrders({
    tableSessionId: resolvingTable && deepLinkSession ? deepLinkSession.id : -1,
    limit: 100,
  })
  const openOrdersForDeepLinkSession = (ordersForDeepLinkSession?.data ?? []).filter(
    (order) => !CLOSED_ORDER_STATUSES.has(order.status),
  )
  const deepLinkTableOrder =
    openOrdersForDeepLinkSession.length === 1 ? openOrdersForDeepLinkSession[0] : undefined
  const needsOrderChooser =
    resolvingTable &&
    !!deepLinkSession &&
    !isLoadingSessionOrder &&
    openOrdersForDeepLinkSession.length !== 1 &&
    chooserDismissedForTableId !== Number(deepLinkTableId)
  // Once an order is found, keep treating this as "still resolving" (not
  // "no order — start a sale") until router.replace below actually lands
  // and activeOrderId picks it up — otherwise there's a one-render gap
  // where loading is done but the URL/state hasn't caught up yet, and it
  // falls through to flash the start-sale screen before redirecting.
  const isResolvingTableDeepLink =
    resolvingTable &&
    (isLoadingTableSession || (!!deepLinkSession && isLoadingSessionOrder) || !!deepLinkTableOrder)

  useEffect(() => {
    // Normalizes ?tableId= to ?orderId= via replace (not push) — resolving a
    // table deep link isn't a new "sale switch" in its own right, so it
    // shouldn't add an extra stop in the back/forward history.
    if (deepLinkTableOrder) router.replace(`/pos?orderId=${deepLinkTableOrder.id}`)
  }, [deepLinkTableOrder, router])

  const { data: deepLinkTableForChooser } = useDiningTable(
    needsOrderChooser ? Number(deepLinkTableId) : 0,
  )

  // Once resolved with no active session at all, this table needs a fresh
  // sale — StartSaleDialog opens itself and pre-fills the table.
  const preselectedTableId =
    resolvingTable && !isResolvingTableDeepLink && !deepLinkSession && deepLinkTableId
      ? Number(deepLinkTableId)
      : undefined

  // Derived, not synced via effect: once the deep-linked order resolves, its
  // outlet wins over the active outlet (e.g. opening a link for a different
  // outlet than the one currently selected).
  const effectiveOutletId = deepLinkOrder?.outletId ?? outletId

  // Keep the cart's item status badges live as the kitchen advances items
  // (Sent -> Preparing -> Ready) — same KDS socket the /kitchen board uses.
  useKitchenRealtime(effectiveOutletId)

  // One request for tables + food categories + addons instead of three; it
  // also seeds the caches those hooks below read from.
  usePosBootstrap(effectiveOutletId)

  // Switching outlets (via the header switcher) drops any in-progress sale
  // for the previous outlet. Skips the initial mount so a deep link's
  // ?orderId=/?tableId= isn't wiped out.
  const previousOutletId = useRef(outletId)
  useEffect(() => {
    if (previousOutletId.current !== outletId) {
      previousOutletId.current = outletId
      router.push("/pos")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId])

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
              <StartSaleDialog
                outletId={effectiveOutletId}
                onSaleStarted={(orderId) => router.push(`/pos?orderId=${orderId}`)}
                preselectedTableId={preselectedTableId}
              />
            )
          )}
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : isResolvingTableDeepLink ? (
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-64 w-full max-w-md" />
        </div>
      ) : !activeOrderId ? (
        // No table/order picked yet — the floor plan doubles as the "start or
        // continue a sale" screen so there's no separate stop at /floor first.
        <div className="flex-1 overflow-y-auto">
          <FloorBoard outletId={effectiveOutletId} />
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
          onSelectOrder={(orderId) => router.replace(`/pos?orderId=${orderId}`)}
        />
      )}
    </div>
  )
}
