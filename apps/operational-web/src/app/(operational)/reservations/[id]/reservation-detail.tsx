"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@rms/ui/badge"
import { Button } from "@rms/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@rms/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@rms/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { Skeleton } from "@rms/ui/skeleton"
import { useCustomer } from "@rms/api-client/hooks/use-customers"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useOutlet } from "@rms/api-client/hooks/use-outlets"
import {
  useAssignReservationTable,
  useReservation,
  useReservationTables,
  useUnassignReservationTable,
  useUpdateReservation,
  useUpdateReservationStatus,
} from "@rms/api-client/hooks/use-reservations"
import {
  RESERVATION_DEPOSIT_STATUSES,
  RESERVATION_STATUSES,
  updateReservationSchema,
  type UpdateReservationInput,
} from "@rms/validators/reservations"
import type { Reservation } from "@rms/api-client/hooks/use-reservations"

export function ReservationDetail({ reservationId }: { reservationId: number }) {
  const { data: reservation, isLoading } = useReservation(reservationId)

  if (isLoading || !reservation) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  // Split into its own component, mounted only once `reservation` is
  // guaranteed to be loaded: useForm's `values` option syncs reactively,
  // but only after the render that first sees it — if this component's own
  // first render (back when `reservation` was still undefined) already
  // mounted the inputs, Base UI's Input primitive locks into "uncontrolled"
  // at that mount and never picks up the synced value afterward (fields
  // render permanently blank despite the data being loaded correctly).
  // Mounting fresh here means the form's very first render already has the
  // real values, so the inputs are controlled from the start.
  return <ReservationDetailForm reservationId={reservationId} reservation={reservation} />
}

function ReservationDetailForm({
  reservationId,
  reservation,
}: {
  reservationId: number
  reservation: Reservation
}) {
  const { data: customer } = useCustomer(reservation.customerId)
  const { data: outlet } = useOutlet(reservation.outletId)
  const updateReservation = useUpdateReservation(reservationId)
  const updateStatus = useUpdateReservationStatus(reservationId)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const isCancellable = !["cancelled", "completed", "no_show"].includes(reservation.status)

  const form = useForm<UpdateReservationInput>({
    resolver: zodResolver(updateReservationSchema),
    defaultValues: {
      reservedAt: reservation.reservedAt.slice(0, 16),
      guestCount: reservation.guestCount,
      source: reservation.source as UpdateReservationInput["source"],
      specialRequest: reservation.specialRequest ?? "",
      internalNote: reservation.internalNote ?? "",
      depositAmount: reservation.depositAmount,
      depositStatus: reservation.depositStatus as UpdateReservationInput["depositStatus"],
    },
  })

  async function onSubmit(values: UpdateReservationInput) {
    try {
      await updateReservation.mutateAsync({
        ...values,
        reservedAt: values.reservedAt ? new Date(values.reservedAt).toISOString() : undefined,
      })
      toast.success("Reservation updated")
      setIsEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update reservation")
    }
  }

  function handleCancelEdit() {
    form.reset()
    setIsEditing(false)
  }

  async function handleStatusChange(status: string) {
    try {
      await updateStatus.mutateAsync(status)
      toast.success(`Status changed to ${status}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change status")
    }
  }

  async function handleCancelReservation() {
    try {
      await updateStatus.mutateAsync("cancelled")
      toast.success("Reservation cancelled")
      setConfirmingCancel(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel reservation")
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{customer?.name ?? `Customer #${reservation.customerId}`}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{outlet?.name ?? `Outlet #${reservation.outletId}`}</p>
            {customer?.phone && <p className="text-sm text-muted-foreground">&middot; {customer.phone}</p>}
            <Badge variant="secondary">{reservation.source}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-48">
            <Select value={reservation.status} onValueChange={(value) => value && handleStatusChange(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESERVATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isCancellable && !confirmingCancel && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmingCancel(true)}>
              Cancel reservation
            </Button>
          )}
          {isCancellable && confirmingCancel && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelReservation}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? "Cancelling..." : "Confirm cancel"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
                Keep it
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardAction>
            {!isEditing && (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                Edit reservation
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Reserved for</span>
              <span className="text-right">{new Date(reservation.reservedAt).toLocaleString()}</span>
              <span className="text-muted-foreground">Guests</span>
              <span className="text-right">{reservation.guestCount}</span>
              <span className="text-muted-foreground">Special request</span>
              <span className="text-right">{reservation.specialRequest || "—"}</span>
              <span className="text-muted-foreground">Internal note</span>
              <span className="text-right">{reservation.internalNote || "—"}</span>
              <span className="text-muted-foreground">Deposit amount</span>
              <span className="text-right">{reservation.depositAmount}</span>
              <span className="text-muted-foreground">Deposit status</span>
              <span className="text-right capitalize">{reservation.depositStatus.replace(/_/g, " ")}</span>
            </div>
          ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reservedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reserved for</FormLabel>
                    <FormControl type="datetime-local" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guests</FormLabel>
                    <FormControl
                      type="number"
                      step="1"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialRequest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special request</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="internalNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal note</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit amount</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESERVATION_DEPOSIT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={updateReservation.isPending}>
                  {updateReservation.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {customer ? (
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Name</span>
              <span className="text-right">{customer.name}</span>
              <span className="text-muted-foreground">Phone</span>
              <span className="text-right">{customer.phone ?? "—"}</span>
              <span className="text-muted-foreground">Email</span>
              <span className="text-right">{customer.email ?? "—"}</span>
            </div>
          ) : (
            <p className="text-muted-foreground">Loading customer...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline &amp; deposit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Deposit amount</span>
            <span className="text-right">{reservation.depositAmount}</span>
            <span className="text-muted-foreground">Deposit status</span>
            <span className="text-right capitalize">{reservation.depositStatus.replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">Created</span>
            <span className="text-right">{new Date(reservation.createdAt).toLocaleString()}</span>
            <span className="text-muted-foreground">Confirmed</span>
            <span className="text-right">
              {reservation.confirmedAt ? new Date(reservation.confirmedAt).toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground">Seated</span>
            <span className="text-right">
              {reservation.seatedAt ? new Date(reservation.seatedAt).toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground">Completed</span>
            <span className="text-right">
              {reservation.completedAt ? new Date(reservation.completedAt).toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground">Cancelled</span>
            <span className="text-right">
              {reservation.cancelledAt ? new Date(reservation.cancelledAt).toLocaleString() : "—"}
            </span>
            <span className="text-muted-foreground">No-show</span>
            <span className="text-right">
              {reservation.noShowAt ? new Date(reservation.noShowAt).toLocaleString() : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <ReservationTablesSection reservationId={reservationId} outletId={reservation.outletId} />
    </div>
  )
}

function ReservationTablesSection({ reservationId, outletId }: { reservationId: number; outletId: number }) {
  const { data: assignments } = useReservationTables(reservationId)
  const { data: tables } = useDiningTables({ outletId, limit: 100 })
  const assignTable = useAssignReservationTable(reservationId)
  const unassignTable = useUnassignReservationTable(reservationId)
  const [selectedTableId, setSelectedTableId] = useState<string>("")

  const tableName = (diningTableId: number) => tables?.data.find((t) => t.id === diningTableId)?.name ?? `#${diningTableId}`
  const hasTable = (assignments?.length ?? 0) > 0

  // A reservation has one table in the normal case, so once one is picked,
  // the picker's job switches from "assign" to "change" — replacing the
  // current table rather than piling a second one on alongside it (still
  // possible one-by-one via each badge's own Remove, for the genuine
  // multi-table/large-party case).
  async function handleAssignOrChange() {
    if (!selectedTableId) return
    try {
      for (const assignment of assignments ?? []) {
        await unassignTable.mutateAsync(assignment.diningTableId)
      }
      await assignTable.mutateAsync({ diningTableId: Number(selectedTableId) })
      toast.success(hasTable ? "Table changed" : "Table assigned")
      setSelectedTableId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change table")
    }
  }

  async function handleUnassign(diningTableId: number) {
    try {
      await unassignTable.mutateAsync(diningTableId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unassign table")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(assignments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tables assigned.</p>}
          {(assignments ?? []).map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-1.5">
              <Badge variant="secondary">{tableName(assignment.diningTableId)}</Badge>
              <Button variant="ghost" size="sm" onClick={() => handleUnassign(assignment.diningTableId)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">{hasTable ? "Change table" : "Assign a table"}</label>
            <Select value={selectedTableId} onValueChange={(value) => setSelectedTableId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.data.map((tableItem) => (
                  <SelectItem key={tableItem.id} value={String(tableItem.id)}>
                    {tableItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAssignOrChange}
            disabled={!selectedTableId || assignTable.isPending || unassignTable.isPending}
          >
            {hasTable ? "Change table" : "Assign"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
