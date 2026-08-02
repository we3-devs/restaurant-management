"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrder, useOrders } from "@/hooks/use-orders"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useKitchenRealtime } from "@/hooks/use-kitchen-realtime"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePosBootstrap } from "@/hooks/use-bootstrap"
import { CategoryTabs } from "./category-tabs"
import { FloatingCart } from "./floating-cart"
import { FoodGrid } from "./food-grid"
import { OrderSwitcher } from "./order-switcher"
import { StartSaleDialog } from "./start-sale-dialog"

export default function PosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get("orderId")
  const deepLinkTableId = searchParams.get("tableId")
  const { outletId, setOutletId, outlets, showOutletPicker, departments, departmentId } = useActiveOutlet()
  const [activeOrderId, setActiveOrderId] = useState<number | null>(
    deepLinkOrderId ? Number(deepLinkOrderId) : null,
  )
  const [categoryId, setCategoryId] = useState<number | null>(null)
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
  // whether that table already has an active session/order. If it does,
  // jump straight into it, same as the ?orderId= deep link above. If not,
  // fall through to StartSaleDialog pre-filled for this table.
  const resolvingTable = !activeOrderId && !deepLinkOrderId && !!deepLinkTableId
  const { data: tableSessionsForDeepLink, isLoading: isLoadingTableSession } = useTableSessions({
    diningTableId: resolvingTable ? Number(deepLinkTableId) : -1,
    status: "active",
    limit: 1,
  })
  const deepLinkSession = tableSessionsForDeepLink?.data[0]
  const { data: ordersForDeepLinkSession, isLoading: isLoadingSessionOrder } = useOrders({
    tableSessionId: resolvingTable && deepLinkSession ? deepLinkSession.id : -1,
    limit: 1,
  })
  const deepLinkTableOrder = ordersForDeepLinkSession?.data[0]
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

  // Once resolved with no active session/order, this table needs a fresh
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
  // also seeds the caches those hooks below read from. Departments come from
  // the active outlet/department context instead (assignment-driven, no
  // outlet-departments.view permission needed).
  usePosBootstrap(effectiveOutletId)
  const prepDepartments = departments.filter((d) => d.canPrepareOrder)

  // "" = not explicitly chosen yet — defaults to the department already
  // auto-selected by the outlet/department context (the user's own
  // assignment, or the first prep department if they hold none here).
  // "none" = explicitly no department (e.g. bottled drinks that need no prep routing).
  const defaultDepartment = prepDepartments.find((d) => d.id === departmentId) ?? prepDepartments[0]
  const [routingChoice, setRoutingChoice] = useState<string>("")
  const effectiveRoutingId =
    routingChoice === "none" ? null : routingChoice ? Number(routingChoice) : (defaultDepartment?.id ?? null)
  const routingSelectValue = routingChoice || (defaultDepartment ? String(defaultDepartment.id) : "none")

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">POS</h1>
        <div className="flex items-center gap-2">
          {showOutletPicker && (
            <div className="w-56">
              <Select
                value={effectiveOutletId ? String(effectiveOutletId) : ""}
                onValueChange={(value) => {
                  setOutletId(value ? Number(value) : null)
                  setRoutingChoice("")
                  router.push("/pos")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={String(outlet.id)}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {prepDepartments.length > 1 && (
            <div className="w-48">
              <Select value={routingSelectValue} onValueChange={(value) => setRoutingChoice(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Route to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department (grab &amp; serve)</SelectItem>
                  {prepDepartments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {effectiveOutletId && <OrderSwitcher outletId={effectiveOutletId} activeOrderId={activeOrderId} />}
          {activeOrderId && (
            <Button variant="outline" onClick={() => router.push("/pos")}>
              New sale
            </Button>
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
        <div className="flex flex-1 items-center justify-center">
          <StartSaleDialog
            outletId={effectiveOutletId}
            onSaleStarted={(orderId) => router.push(`/pos?orderId=${orderId}`)}
            preselectedTableId={preselectedTableId}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <CategoryTabs categoryId={categoryId} onSelect={setCategoryId} />
          <FoodGrid orderId={activeOrderId} categoryId={categoryId} preparationDepartmentId={effectiveRoutingId} />
          <FloatingCart orderId={activeOrderId} />
        </div>
      )}
    </div>
  )
}
