"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ClockIcon, DropletIcon, HandIcon, ReceiptIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { useCurrentUser } from "@rms/auth/current-user-context"
import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rms/ui/dialog"
import { Input } from "@rms/ui/input"
import { Label } from "@rms/ui/label"
import { Separator } from "@rms/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { apiClient } from "@rms/api-client/client"
import { queryKeys } from "@rms/api-client/query-keys"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { useDiningTables, type DiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { useOrders } from "@rms/api-client/hooks/use-orders"
import { useCreateReservation, type Reservation } from "@rms/api-client/hooks/use-reservations"
import {
  useCreateServiceRequest,
  type ServiceRequestType,
} from "@rms/api-client/hooks/use-service-requests"
import {
  useEndTableSession,
  useSetTableSessionCustomer,
  useTableSessions,
  useTransferTableSession,
} from "@rms/api-client/hooks/use-table-sessions"
import { CheckoutPanel } from "../pos/checkout-panel"

function formatSeatedFor(startedAt: string | null): string | null {
  if (!startedAt) return null
  const minutes = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000))
  if (minutes < 1) return "just seated"
  if (minutes < 60) return `seated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `seated ${hours}h${remainder ? ` ${remainder}m` : ""} ago`
}

export function TableActionsDialog({ table, onClose }: { table: DiningTable; onClose: () => void }) {
  const router = useRouter()
  const user = useCurrentUser()
  // Cashiers get everything waiters get (order-taking, transfer, end session,
  // reservations) plus cashier-only tools: customer assignment, in-dialog
  // checkout, and calling a waiter on the guest's behalf.
  const isCashier = !user.isSuperadmin && user.roleSlugs.includes("cashier")
  // Waiters take and transfer orders but don't close out a table — that's
  // the cashier's/manager's call once payment is settled.
  const isWaiter = !user.isSuperadmin && user.roleSlugs.includes("waiter")
  const { data: sessions } = useTableSessions({
    diningTableId: table.id,
    status: "active",
    limit: 1,
  })
  const activeSession = sessions?.data[0]
  const { data: orders } = useOrders({
    tableSessionId: activeSession?.id,
    limit: 1,
    excludeStatus: ["cancelled"],
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
  const createRequest = useCreateServiceRequest()

  const setSessionCustomer = useSetTableSessionCustomer(activeSession?.id ?? 0)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [sessionCustomerId, setSessionCustomerId] = useState("")
  const [showCheckout, setShowCheckout] = useState(false)

  const queryClient = useQueryClient()
  const { data: customers } = useCustomers({ limit: 100 })
  const createReservation = useCreateReservation()
  const [showReserve, setShowReserve] = useState(false)
  const [reserveCustomerId, setReserveCustomerId] = useState("")
  const [reserveAt, setReserveAt] = useState("")
  const [reserveGuestCount, setReserveGuestCount] = useState(table.capacity)
  const [reserveDepositAmount, setReserveDepositAmount] = useState(0)
  const [reserveSpecialRequest, setReserveSpecialRequest] = useState("")
  const [reserveInternalNote, setReserveInternalNote] = useState("")

  async function handleCallWaiter(type: ServiceRequestType) {
    try {
      await createRequest.mutateAsync({ diningTableId: table.id, type })
      toast.success("Request sent to the service queue")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request")
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

  async function handleReserve() {
    if (!reserveCustomerId || !reserveAt) {
      toast.error("Pick a customer and a date/time")
      return
    }
    try {
      const reservation = await createReservation.mutateAsync({
        outletId: table.outletId,
        customerId: Number(reserveCustomerId),
        reservedAt: new Date(reserveAt).toISOString(),
        guestCount: reserveGuestCount,
        source: "staff",
        depositAmount: reserveDepositAmount,
        specialRequest: reserveSpecialRequest || undefined,
        internalNote: reserveInternalNote || undefined,
      })
      await apiClient<Reservation>(`/reservations/${reservation.id}/tables`, {
        method: "POST",
        body: JSON.stringify({ diningTableId: table.id }),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.lists() })
      toast.success(`${table.name} reserved`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reserve table")
    }
  }

  async function handleSetCustomer() {
    if (!sessionCustomerId) return
    try {
      await setSessionCustomer.mutateAsync(Number(sessionCustomerId))
      toast.success("Customer updated")
      setShowCustomerPicker(false)
      setSessionCustomerId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer")
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
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {(activeSession.customer?.name ?? "W")[0]?.toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">
                    {activeSession.customer?.name ?? "Walk-in guest"}
                  </p>
                  {activeSession.customer?.phone ? (
                    <a
                      href={`tel:${activeSession.customer.phone}`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {activeSession.customer.phone}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">Walk-in &middot; no phone on file</p>
                  )}
                </div>
              </div>
              {activeSession.customer?.loyaltyTier && (
                <Badge variant="secondary">{activeSession.customer.loyaltyTier}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 rounded-lg border border-input px-3 py-2">
                <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {activeSession.guestCount} of {table.capacity} seat{table.capacity === 1 ? "" : "s"}
                </span>
              </div>
              {formatSeatedFor(activeSession.startedAt) && (
                <div className="flex items-center gap-2 rounded-lg border border-input px-3 py-2">
                  <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="capitalize">{formatSeatedFor(activeSession.startedAt)}</span>
                </div>
              )}
            </div>

            {activeOrder && (
              <div className="flex items-center justify-between rounded-lg border border-input bg-muted/30 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Order so far</span>
                <div className="text-right">
                  <p className="text-base font-semibold leading-none">{activeOrder.grandTotal.toFixed(2)}</p>
                  {activeOrder.dueAmount > 0 && (
                    <p className="mt-1 text-xs font-medium text-destructive">
                      {activeOrder.dueAmount.toFixed(2)} due
                    </p>
                  )}
                </div>
              </div>
            )}

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
                  {!isWaiter && (
                    <Button variant="destructive" onClick={handleEnd} disabled={endSession.isPending}>
                      {endSession.isPending ? "Ending..." : "End session"}
                    </Button>
                  )}
                </div>
              )}

            {isCashier && (
              <>
                <Separator />

                {/* Customer of record — assign or correct who the table is seated under. */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Customer</p>
                  {showCustomerPicker ? (
                    <div className="space-y-2">
                      <Select value={sessionCustomerId} onValueChange={(value) => setSessionCustomerId(value ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.data.map((customer) => (
                            <SelectItem key={customer.id} value={String(customer.id)}>
                              {customer.name}
                              {customer.phone ? ` — ${customer.phone}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSetCustomer}
                          disabled={!sessionCustomerId || setSessionCustomer.isPending}
                        >
                          {setSessionCustomer.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCustomerPicker(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowCustomerPicker(true)}>
                      {activeSession.customer ? "Change customer" : "Assign customer"}
                    </Button>
                  )}
                </div>

                {/* Payment — cashier takes payment for the table's order without leaving the floor view. */}
                {activeOrder && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Payment</p>
                    {showCheckout ? (
                      <>
                        <CheckoutPanel orderId={activeOrder.id} />
                        <Button size="sm" variant="ghost" onClick={() => setShowCheckout(false)}>
                          Close
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => setShowCheckout(true)}>
                        Take payment
                      </Button>
                    )}
                  </div>
                )}

                <Separator />

                {/* Call waiter — cashier raises the request on the guest's behalf. */}
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
              </>
            )}
          </div>
        )}

        {table.status === "available" && !showReserve && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This table is free. Start a sale from the POS screen and pick this table when seating a walk-in, or
              reserve it for later.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowReserve(true)}>
              Reserve this table
            </Button>
          </div>
        )}

        {table.status === "available" && showReserve && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={reserveCustomerId} onValueChange={(value) => setReserveCustomerId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.data.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name}
                      {customer.phone ? ` — ${customer.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reserved for</Label>
                <Input
                  type="datetime-local"
                  value={reserveAt}
                  onChange={(e) => setReserveAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={reserveGuestCount}
                  onChange={(e) => setReserveGuestCount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reservation amount (deposit)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={reserveDepositAmount}
                onChange={(e) => setReserveDepositAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Special request (optional)</Label>
              <Input
                value={reserveSpecialRequest}
                onChange={(e) => setReserveSpecialRequest(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Internal note (optional)</Label>
              <Input value={reserveInternalNote} onChange={(e) => setReserveInternalNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleReserve}
                disabled={createReservation.isPending || !reserveCustomerId || !reserveAt}
              >
                {createReservation.isPending ? "Reserving..." : "Confirm reservation"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReserve(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {table.status !== "occupied" && table.status !== "available" && (
          <p className="text-sm text-muted-foreground">
            {table.status === "reserved" && "This table is reserved for an upcoming booking."}
            {table.status === "cleaning" && "This table is being cleaned and isn't ready for guests yet."}
            {table.status === "inactive" && "This table isn't in service right now."}
          </p>
        )}

        {table.status === "available" && !showReserve && (
          <DialogFooter>
            <Button
              onClick={() => {
                onClose()
                router.push("/pos")
              }}
            >
              Go to POS
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
