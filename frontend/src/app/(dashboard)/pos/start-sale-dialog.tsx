"use client"

import { useState } from "react"
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
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useStartTableSession, useTableSessions } from "@/hooks/use-table-sessions"
import { ORDER_TYPES } from "@/lib/validators/orders"

type OrderType = (typeof ORDER_TYPES)[number]

export function StartSaleDialog({
  outletId,
  onSaleStarted,
}: {
  outletId: number
  onSaleStarted: (orderId: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>("dine_in")
  const [tableSessionId, setTableSessionId] = useState<string>("")
  const [newTableId, setNewTableId] = useState<string>("")
  const [guestCount, setGuestCount] = useState(2)

  const { data: sessions } = useTableSessions({ outletId, status: "active", limit: 100 })
  const { data: availableTables } = useDiningTables({ outletId, status: "available", limit: 100 })
  const startSession = useStartTableSession()
  const createOrder = useCreateOrder()

  function reset() {
    setOrderType("dine_in")
    setTableSessionId("")
    setNewTableId("")
    setGuestCount(2)
  }

  async function handleStart() {
    try {
      let resolvedSessionId: number | undefined

      if (orderType === "dine_in") {
        if (tableSessionId) {
          resolvedSessionId = Number(tableSessionId)
        } else if (newTableId) {
          const session = await startSession.mutateAsync({
            outletId,
            diningTableId: Number(newTableId),
            guestCount,
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

          {orderType === "dine_in" && (
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
