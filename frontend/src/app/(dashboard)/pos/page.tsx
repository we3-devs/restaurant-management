"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOrder } from "@/hooks/use-orders"
import { useOutletDepartments } from "@/hooks/use-outlet-departments"
import { useKitchenRealtime } from "@/hooks/use-kitchen-realtime"
import { useOutlets } from "@/hooks/use-outlets"
import { usePosBootstrap } from "@/hooks/use-bootstrap"
import { CartPanel } from "./cart-panel"
import { CategorySidebar } from "./category-sidebar"
import { FoodGrid } from "./food-grid"
import { StartSaleDialog } from "./start-sale-dialog"

const OUTLET_STORAGE_KEY = "pos-outlet-id"

function readStoredOutletId(): number | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(OUTLET_STORAGE_KEY)
  return stored ? Number(stored) : null
}

export default function PosPage() {
  const searchParams = useSearchParams()
  const deepLinkOrderId = searchParams.get("orderId")
  const { data: outlets } = useOutlets({ limit: 100 })
  const [outletId, setOutletId] = useState<number | null>(() => readStoredOutletId())
  const [activeOrderId, setActiveOrderId] = useState<number | null>(
    deepLinkOrderId ? Number(deepLinkOrderId) : null,
  )
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const { data: deepLinkOrder } = useOrder(activeOrderId && deepLinkOrderId ? activeOrderId : 0)

  // Derived, not synced via effect: once the deep-linked order resolves, its
  // outlet wins; otherwise fall back to the explicitly selected/stored outlet,
  // then the first outlet once the list loads.
  const effectiveOutletId = deepLinkOrder?.outletId ?? outletId ?? outlets?.data[0]?.id ?? null

  useEffect(() => {
    if (effectiveOutletId) localStorage.setItem(OUTLET_STORAGE_KEY, String(effectiveOutletId))
  }, [effectiveOutletId])

  // Keep the cart's item status badges live as the kitchen advances items
  // (Sent -> Preparing -> Ready) — same KDS socket the /kitchen board uses.
  useKitchenRealtime(effectiveOutletId)

  // One request for departments + tables + food categories + addons instead
  // of four; it also seeds the caches those hooks below read from.
  usePosBootstrap(effectiveOutletId)
  const { data: departments } = useOutletDepartments({ outletId: effectiveOutletId ?? undefined, limit: 100 })
  const prepDepartments = (departments?.data ?? []).filter((d) => d.canPrepareOrder)

  // "" = not explicitly chosen yet (defaults to the first prep department),
  // "none" = explicitly no department (e.g. bottled drinks that need no prep routing).
  const [routingChoice, setRoutingChoice] = useState<string>("")
  const effectiveRoutingId =
    routingChoice === "none" ? null : routingChoice ? Number(routingChoice) : (prepDepartments[0]?.id ?? null)
  const routingSelectValue = routingChoice || (prepDepartments[0] ? String(prepDepartments[0].id) : "none")

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">POS</h1>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <Select
              value={effectiveOutletId ? String(effectiveOutletId) : ""}
              onValueChange={(value) => {
                setOutletId(value ? Number(value) : null)
                setActiveOrderId(null)
                setRoutingChoice("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets?.data.map((outlet) => (
                  <SelectItem key={outlet.id} value={String(outlet.id)}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {activeOrderId && (
            <Button variant="outline" onClick={() => setActiveOrderId(null)}>
              New sale
            </Button>
          )}
        </div>
      </div>

      {!effectiveOutletId ? (
        <p className="text-sm text-muted-foreground">Select an outlet to start.</p>
      ) : !activeOrderId ? (
        <div className="flex flex-1 items-center justify-center">
          <StartSaleDialog outletId={effectiveOutletId} onSaleStarted={setActiveOrderId} />
        </div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-hidden">
          <CategorySidebar categoryId={categoryId} onSelect={setCategoryId} />
          <FoodGrid orderId={activeOrderId} categoryId={categoryId} preparationDepartmentId={effectiveRoutingId} />
          <CartPanel orderId={activeOrderId} />
        </div>
      )}
    </div>
  )
}
