"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rms/ui/dialog"
import { Button } from "@rms/ui/button"
import { Label } from "@rms/ui/label"
import { Input } from "@rms/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { useCreateOrder } from "@rms/api-client/hooks/use-orders"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import type { PosBootstrapTable } from "@rms/api-client/hooks/use-bootstrap"
import { tableSessionName, useOpenTableSession, useTableSessions } from "@rms/api-client/hooks/use-table-sessions"
import { ORDER_TYPES } from "@rms/validators/orders"
import { useOperatingHours } from "@rms/api-client/hooks/use-operating-hours"
import { ClosedHoursOverrideButton } from "@/components/closed-hours-override-button"

type OrderType = (typeof ORDER_TYPES)[number]

/**
 * Only ever rendered by its parent page once opening is actually intended
 * (the "Start sale" button click, or a preselected-table deep link) — see
 * useStartSaleDialogState. Mounting this component is what fires its data
 * hooks (table-sessions/customers below), so it must never be present in
 * the tree "just in case"; `open`/`onOpenChange` are owned by the parent
 * instead of local state so the parent can lazily mount it and still fully
 * control it.
 */
export function StartSaleDialog({
  open,
  onOpenChange,
  outletId,
  onSaleStarted,
  preselectedTableId,
  tables,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  outletId: number
  onSaleStarted: (orderId: number) => void
  preselectedTableId?: number
  /** Already-loaded outlet tables (from usePosBootstrap) — avoids a redundant dining-tables request just to list available ones / resolve the preselected table's name. */
  tables: PosBootstrapTable[]
}) {
  const [orderType, setOrderType] = useState<OrderType>("table")
  const [tableSessionId, setTableSessionId] = useState<string>("")
  const [newTableId, setNewTableId] = useState<string>(
    preselectedTableId ? String(preselectedTableId) : "",
  )
  const [guestCount, setGuestCount] = useState(2)
  const [customerId, setCustomerId] = useState<string>("")

  // Arriving via a table-card click on /floor (?tableId=...) — jump straight
  // into the walk-in form pre-filled for that table instead of making the
  // user re-pick it from the dropdown. Opening itself is the parent's job
  // (it mounts this component in response to the same preselectedTableId);
  // this only owns the form fields. Adjusts state during render (not an
  // effect) — same idiom as useStartSaleDialogState/CheckoutPanel.
  const [seededTableId, setSeededTableId] = useState<number | undefined>(
    preselectedTableId,
  )
  if (preselectedTableId !== undefined && preselectedTableId !== seededTableId) {
    setSeededTableId(preselectedTableId)
    setOrderType("table")
    setTableSessionId("")
    setNewTableId(String(preselectedTableId))
  }

  const { data: sessions } = useTableSessions({ outletId, status: "active", limit: 100 })
  const availableTables = tables.filter((table) => table.status === "available")
  const preselectedTable = tables.find((table) => table.id === preselectedTableId)
  const { data: customers } = useCustomers({ limit: 100 })
  const openTableSession = useOpenTableSession()
  const createOrder = useCreateOrder()
  const openTableSessionOverride = useOpenTableSession({ closedHoursOverride: true })
  const createOrderOverride = useCreateOrder({ closedHoursOverride: true })
  const { data: operatingHours } = useOperatingHours(outletId)

  function reset() {
    setOrderType("table")
    setTableSessionId("")
    setNewTableId("")
    setGuestCount(2)
    setCustomerId("")
  }

  async function handleStart() {
    try {
      let orderId: number

      if (orderType === "table" && !tableSessionId) {
        if (!newTableId) {
          toast.error("Pick an active table or seat a walk-in table first")
          return
        }
        // Seating a brand-new walk-in table: one atomic request opens the
        // table session and creates its first order together, so there's
        // never a session id without a matching order to navigate to.
        const result = await openTableSession.mutateAsync({
          outletId,
          diningTableId: Number(newTableId),
          guestCount: preselectedTableId ? (preselectedTable?.capacity ?? 1) : guestCount,
          customerId: customerId ? Number(customerId) : undefined,
          orderType,
        })
        if (!result?.order) throw new Error("Table session opened but no order was returned")
        orderId = result.order.id
      } else {
        // orderType !== "table" (no session needed), or an already-seated
        // table was picked from the dropdown (session already exists).
        const order = await createOrder.mutateAsync({
          outletId,
          tableSessionId: tableSessionId ? Number(tableSessionId) : undefined,
          orderType,
        })
        orderId = order.id
      }

      toast.success("Sale started")
      reset()
      onOpenChange(false)
      onSaleStarted(orderId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start sale")
    }
  }

  async function handleStartOverride() {
    let orderId: number
    if (orderType === "table" && !tableSessionId) {
      if (!newTableId) throw new Error("Pick an active table or seat a walk-in table first")
      const result = await openTableSessionOverride.mutateAsync({ outletId, diningTableId: Number(newTableId), guestCount: preselectedTableId ? (preselectedTable?.capacity ?? 1) : guestCount, customerId: customerId ? Number(customerId) : undefined, orderType })
      if (!result?.order) throw new Error("Table session opened but no order was returned")
      orderId = result.order.id
    } else {
      const order = await createOrderOverride.mutateAsync({ outletId, tableSessionId: tableSessionId ? Number(tableSessionId) : undefined, orderType })
      orderId = order.id
    }
    toast.success("Sale started")
    reset()
    onOpenChange(false)
    onSaleStarted(orderId)
  }

  const busy = openTableSession.isPending || createOrder.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preselectedTableId ? (
            <>
              <div className="space-y-1.5">
                <Label>Table</Label>
                <Input value={preselectedTable?.name ?? "Loading…"} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Customer (optional)</Label>
                <Select value={customerId || "none"} onValueChange={(value) => setCustomerId(value === "none" ? "" : (value ?? ""))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Walk-in" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Walk-in (no customer)</SelectItem>
                    {customers?.data.map((customer) => (
                      <SelectItem key={customer.id} value={String(customer.id)}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Order type</Label>
                <Select value={orderType} onValueChange={(value) => value && setOrderType(value as OrderType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {orderType === "table" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Active table</Label>
                    <Select
                      value={tableSessionId || "none"}
                      onValueChange={(value) => {
                        setTableSessionId(value === "none" ? "" : (value ?? ""))
                        setNewTableId("")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose an already-seated table" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None — seat a walk-in instead</SelectItem>
                        {sessions?.data.map((session) => (
                          <SelectItem key={session.id} value={String(session.id)}>
                            {tables.find((t) => t.id === session.diningTableId)?.name ?? "Loading…"} ({tableSessionName(session)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!tableSessionId && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label>Seat a walk-in table</Label>
                        <Select value={newTableId} onValueChange={(value) => setNewTableId(value ?? "")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select an available table" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTables.map((table) => (
                              <SelectItem key={table.id} value={String(table.id)}>
                                {table.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Guests</Label>
                        <Input
                          type="number"
                          min={1}
                          value={guestCount}
                          onChange={(e) => setGuestCount(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleStart} disabled={busy}>
            {busy ? "Starting..." : "Start sale"}
          </Button>
          <ClosedHoursOverrideButton
            closed={operatingHours?.enabled === true && operatingHours.isOpen === false}
            label="start sale"
            onConfirm={async () => {
              try {
                await handleStartOverride()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to start sale")
              }
            }}
            disabled={busy}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
