import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useOrder, useOrders } from "@/hooks/use-orders"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useDiningTable } from "@/hooks/use-dining-tables"

const CLOSED_ORDER_STATUSES = new Set(["completed", "cancelled"])

/**
 * Resolves the `?orderId=`/`?tableId=` deep-link into an active order,
 * including the "table has zero or several open orders" chooser case.
 * Extracted out of (dashboard)/pos/page.tsx so the staff mobile order-taking
 * page can reuse the exact same resolution logic instead of forking it —
 * `basePath` is the only thing that differs between the two callers
 * ("/pos" vs "/staff/waiter/pos").
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
  const activeOrderId = deepLinkOrderId ? Number(deepLinkOrderId) : null
  const [chooserDismissedForTableId, setChooserDismissedForTableId] = useState<number | null>(null)
  const { data: deepLinkOrder } = useOrder(activeOrderId && deepLinkOrderId ? activeOrderId : 0)

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
  const isResolvingTableDeepLink =
    resolvingTable &&
    (isLoadingTableSession || (!!deepLinkSession && isLoadingSessionOrder) || !!deepLinkTableOrder)

  useEffect(() => {
    if (deepLinkTableOrder) router.replace(`${basePath}?orderId=${deepLinkTableOrder.id}`)
  }, [deepLinkTableOrder, router, basePath])

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
