import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useOrder, useOrders } from "@rms/api-client/hooks/use-orders"
import { useTableSessions } from "@rms/api-client/hooks/use-table-sessions"
import { useDiningTable } from "@rms/api-client/hooks/use-dining-tables"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

/**
 * Resolves the `?orderId=`/`?tableId=` deep-link into an active order,
 * including the "table has zero or several open orders" chooser case.
 * Extracted out of (dashboard)/pos/page.tsx so the staff mobile order-taking
 * page can reuse the exact same resolution logic instead of forking it —
 * `basePath` is the only thing that differs between the two callers
 * ("/pos" vs "/staff/pos").
 */
export function useOrderDeepLink({
  basePath,
  outletId,
  deepLinkOrderId,
  deepLinkTableId,
}: {
  basePath: string
  outletId: number | null
  deepLinkOrderId: string | null
  deepLinkTableId: string | null
}) {
  const router = useRouter()
  // The URL (?orderId=) is the single source of truth for which sale is
  // showing — no local state to desync from it, just derive on every render
  // so the browser's native back/forward buttons work for free.
  const urlOrderId = deepLinkOrderId ? Number(deepLinkOrderId) : null
  const [chooserDismissedForTableId, setChooserDismissedForTableId] = useState<number | null>(null)
  const { data: deepLinkOrder } = useOrder(urlOrderId ?? 0)

  const resolvingTable = !urlOrderId && !deepLinkOrderId && !!deepLinkTableId
  const {
    data: tableSessionsForDeepLink,
    isLoading: isLoadingTableSession,
    isPlaceholderData: isTableSessionPlaceholder,
  } = useTableSessions(
    { diningTableId: resolvingTable ? Number(deepLinkTableId) : undefined, status: "active", limit: 1 },
    // Gated (not just given a meaningless param) so this doesn't fire a
    // wasted GET /table-sessions once resolvingTable goes false — e.g. right
    // after StartSaleDialog navigates to ?orderId=, this query has nothing
    // left to resolve but a bare `enabled: false` param wouldn't have
    // stopped a request from going out under the old `-1` placeholder.
    { enabled: resolvingTable },
  )
  // Both queries below use keepPreviousData (baked into useTableSessions/
  // useOrders), so tapping a different table while this page stays mounted
  // shows the PREVIOUS table's (possibly empty) session/orders as
  // placeholder data — with isLoading already false — while the new table's
  // real data is still in flight. Without isPlaceholderData in the mix,
  // needsOrderChooser/isResolvingTableDeepLink render off that stale data
  // and can flash "has no order yet" for a table that does have one.
  const tableSessionStillResolving = isLoadingTableSession || isTableSessionPlaceholder
  const deepLinkSession = tableSessionStillResolving ? undefined : tableSessionsForDeepLink?.data[0]
  const {
    data: ordersForDeepLinkSession,
    isLoading: isLoadingSessionOrder,
    isPlaceholderData: isSessionOrderPlaceholder,
  } = useOrders(
    { tableSessionId: resolvingTable && deepLinkSession ? deepLinkSession.id : undefined, limit: 100 },
    { enabled: resolvingTable && !!deepLinkSession },
  )
  const sessionOrdersStillResolving = isLoadingSessionOrder || isSessionOrderPlaceholder
  const openOrdersForDeepLinkSession = sessionOrdersStillResolving
    ? []
    : (ordersForDeepLinkSession?.data ?? []).filter((order) => !CLOSED_ORDER_STATUSES.has(order.status))
  const deepLinkTableOrder =
    openOrdersForDeepLinkSession.length === 1 ? openOrdersForDeepLinkSession[0] : undefined
  const needsOrderChooser =
    resolvingTable &&
    !!deepLinkSession &&
    !sessionOrdersStillResolving &&
    openOrdersForDeepLinkSession.length !== 1 &&
    chooserDismissedForTableId !== Number(deepLinkTableId)
  const isResolvingTableDeepLink =
    resolvingTable &&
    (tableSessionStillResolving ||
      (!!deepLinkSession && sessionOrdersStillResolving) ||
      !!deepLinkTableOrder)

  // Keep the table URL while resolving its single open order. This avoids a
  // tableId -> orderId navigation/remount and the second POS loading screen.
  const activeOrderId = urlOrderId ?? deepLinkTableOrder?.id ?? null

  const { data: deepLinkTableForChooser } = useDiningTable(needsOrderChooser ? Number(deepLinkTableId) : 0)

  const preselectedTableId =
    resolvingTable && !isResolvingTableDeepLink && !deepLinkSession && deepLinkTableId
      ? Number(deepLinkTableId)
      : undefined

  const effectiveOutletId = deepLinkOrder?.outletId ?? outletId

  const previousOutletId = useRef(outletId)
  useEffect(() => {
    if (previousOutletId.current !== outletId) {
      previousOutletId.current = outletId
      router.push(basePath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId])

  return {
    activeOrderId,
    effectiveOutletId,
    isResolvingTableDeepLink,
    preselectedTableId,
    needsOrderChooser,
    deepLinkSession,
    deepLinkTableForChooser,
    openOrdersForDeepLinkSession,
    chooserDismissedForTableId,
    setChooserDismissedForTableId,
  }
}
