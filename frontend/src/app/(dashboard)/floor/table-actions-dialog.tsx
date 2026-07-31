"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, DropletIcon, HandIcon, ReceiptIcon } from "lucide-react"
import { toast } from "sonner"

import { QrCode } from "@/components/qr-code"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDiningTables, type DiningTable } from "@/hooks/use-dining-tables"
import { useOrders } from "@/hooks/use-orders"
import {
  useCreateServiceRequest,
  type ServiceRequestType,
} from "@/hooks/use-service-requests"
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
  const [copied, setCopied] = useState(false)
  const createRequest = useCreateServiceRequest()

  const guestUrl = table.code ? `/guest?table=${encodeURIComponent(table.code)}` : null
  const fullGuestUrl = guestUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${guestUrl}`
    : null

  async function handleCallWaiter(type: ServiceRequestType) {
    try {
      await createRequest.mutateAsync({ diningTableId: table.id, type })
      toast.success("Request sent to the service queue")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request")
    }
  }

  async function handleCopyGuestLink() {
    if (!fullGuestUrl) return
    try {
      await navigator.clipboard.writeText(fullGuestUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy — select the link manually")
    }
  }

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

            <Separator />

            {/* Call waiter — staff raises the request on the guest's behalf. */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Call waiter</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={createRequest.isPending}
                  onClick={() => handleCallWaiter("water")}
                >
                  <DropletIcon className="text-sky-500" />
                  Water
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={createRequest.isPending}
                  onClick={() => handleCallWaiter("bill")}
                >
                  <ReceiptIcon className="text-amber-500" />
                  Bill
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={createRequest.isPending}
                  onClick={() => handleCallWaiter("assistance")}
                >
                  <HandIcon />
                  Help
                </Button>
              </div>
            </div>

            {/* Guest QR card — guests scan this to call the waiter themselves. */}
            {fullGuestUrl && (
              <div className="flex items-center gap-4 rounded-lg border border-dashed p-3">
                <QrCode value={fullGuestUrl} size={88} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-medium">Guest card</p>
                  <p className="break-all text-xs text-muted-foreground">{fullGuestUrl}</p>
                  <Button variant="outline" size="sm" onClick={handleCopyGuestLink}>
                    {copied ? <CheckIcon className="text-emerald-500" /> : <CopyIcon />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
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
