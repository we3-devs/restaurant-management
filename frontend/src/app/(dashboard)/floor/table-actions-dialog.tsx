"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDiningTables, type DiningTable } from "@/hooks/use-dining-tables"
import { useOrders } from "@/hooks/use-orders"
import { useEndTableSession, useTableSessions, useTransferTableSession } from "@/hooks/use-table-sessions"

export function TableActionsDialog({ table, onClose }: { table: DiningTable; onClose: () => void }) {
  const router = useRouter()
  const { data: sessions } = useTableSessions({
    diningTableId: table.id,
    status: "active",
    limit: 1,
  })
  const activeSession = sessions?.data[0]
  const { data: orders } = useOrders({
    tableSessionId: activeSession?.id ?? -1,
    limit: 1,
  })
  const activeOrder = orders?.data[0]

  const endSession = useEndTableSession(activeSession?.id ?? 0)
  const transferSession = useTransferTableSession(activeSession?.id ?? 0)
  const { data: availableTables } = useDiningTables({
    outletId: table.outletId,
    status: "available",
    limit: 100,
  })
  const [transferTargetId, setTransferTargetId] = useState("")
  const [showTransfer, setShowTransfer] = useState(false)

  async function handleEnd() {
    try {
      await endSession.mutateAsync()
      toast.success("Session ended")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end session")
    }
  }

  async function handleTransfer() {
    if (!transferTargetId) return
    try {
      await transferSession.mutateAsync({ newDiningTableId: Number(transferTargetId) })
      toast.success("Table transferred")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer table")
    }
  }

  function handleViewOrder() {
    if (activeOrder) {
      router.push(`/pos?orderId=${activeOrder.id}`)
    } else {
      router.push(`/pos`)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {table.name} &mdash; {table.status}
          </DialogTitle>
        </DialogHeader>

        {table.status === "occupied" && activeSession && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {activeSession.guestCount} guest{activeSession.guestCount === 1 ? "" : "s"} &middot; session #
              {activeSession.id}
            </p>

            {showTransfer ? (
              <div className="space-y-2">
                <Select value={transferTargetId} onValueChange={(value) => setTransferTargetId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a free table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables?.data.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleTransfer}
                  disabled={!transferTargetId || transferSession.isPending}
                >
                  {transferSession.isPending ? "Transferring..." : "Confirm transfer"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleViewOrder}>View / add items</Button>
                <Button variant="outline" onClick={() => setShowTransfer(true)}>
                  Transfer table
                </Button>
                <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>
                  {endSession.isPending ? "Ending..." : "End session"}
                </Button>
              </div>
            )}
          </div>
        )}

        {table.status === "available" && (
          <p className="text-sm text-muted-foreground">
            This table is free. Start a sale from the POS screen and pick this table when seating a walk-in.
          </p>
        )}

        {table.status !== "occupied" && table.status !== "available" && (
          <p className="text-sm text-muted-foreground">Status: {table.status}</p>
        )}

        <DialogFooter>
          {table.status === "available" && (
            <Button
              onClick={() => {
                onClose()
                router.push("/pos")
              }}
            >
              Go to POS
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
