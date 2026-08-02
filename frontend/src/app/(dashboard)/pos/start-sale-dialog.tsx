"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateOrder } from "@/hooks/use-orders"
import { useCustomers } from "@/hooks/use-customers"
import { useDiningTable, useDiningTables } from "@/hooks/use-dining-tables"
import { useStartTableSession, useTableSessions } from "@/hooks/use-table-sessions"
import { ORDER_TYPES } from "@/lib/validators/orders"

type OrderType = (typeof ORDER_TYPES)[number]

export function StartSaleDialog({
  outletId,
  onSaleStarted,
  preselectedTableId,
}: {
  outletId: number
  onSaleStarted: (orderId: number) => void
  preselectedTableId?: number
}) {
  const [open, setOpen] = useState(Boolean(preselectedTableId))
  const [orderType, setOrderType] = useState<OrderType>("table")
  const [tableSessionId, setTableSessionId] = useState<string>("")
  const [newTableId, setNewTableId] = useState<string>(
    preselectedTableId ? String(preselectedTableId) : "",
  )
  const [guestCount, setGuestCount] = useState(2)
  const [customerId, setCustomerId] = useState<string>("")

  // Arriving via a table-card click on /floor (?tableId=...) — jump straight
  // into the walk-in form pre-filled for that table instead of making the
  // user re-pick it from the dropdown.
  useEffect(() => {
    if (preselectedTableId) {
      setOpen(true)
      setOrderType("table")
      setTableSessionId("")
      setNewTableId(String(preselectedTableId))
    }
  }, [preselectedTableId])

  const { data: sessions } = useTableSessions({ outletId, status: "active", limit: 100 })
  const { data: availableTables } = useDiningTables({ outletId, status: "available", limit: 100 })
  const { data: preselectedTable } = useDiningTable(preselectedTableId ?? 0)
  const { data: customers } = useCustomers({ limit: 100 })
  const startSession = useStartTableSession()
  const createOrder = useCreateOrder()

  function reset() {
    setOrderType("table")
    setTableSessionId("")
    setNewTableId("")
    setGuestCount(2)
    setCustomerId("")
  }

  async function handleStart() {
    try {
      let resolvedSessionId: number | undefined

      if (orderType === "table") {
        if (tableSessionId) {
          resolvedSessionId = Number(tableSessionId)
        } else if (newTableId) {
          const session = await startSession.mutateAsync({
            outletId,
            diningTableId: Number(newTableId),
            guestCount: preselectedTableId ? (preselectedTable?.capacity ?? 1) : guestCount,
            customerId: customerId ? Number(customerId) : undefined,
          })
          resolvedSessionId = session.id
        } else {
          toast.error("Pick an active table or seat a walk-in table first")
          return
        }
      }

      const order = await createOrder.mutateAsync({
        outletId,
        tableSessionId: resolvedSessionId,
        orderType,
      })
      toast.success("Sale started")
      reset()
      setOpen(false)
      onSaleStarted(order.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start sale")
    }
  }

  const busy = startSession.isPending || createOrder.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg">Start sale</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preselectedTableId ? (
            <>
              <div className="space-y-1.5">
                <Label>Table</Label>
                <Input value={preselectedTable?.name ?? `Table #${preselectedTableId}`} disabled />
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
                            Table #{session.diningTableId} (session #{session.id})
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
                            {availableTables?.data.map((table) => (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
