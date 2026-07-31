"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomer } from "@/hooks/use-customers"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useOutlet } from "@/hooks/use-outlets"
import {
  useAssignReservationTable,
  useReservation,
  useReservationTables,
  useUnassignReservationTable,
  useUpdateReservation,
  useUpdateReservationStatus,
} from "@/hooks/use-reservations"
import {
  RESERVATION_STATUSES,
  updateReservationSchema,
  type UpdateReservationInput,
} from "@/lib/validators/reservations"

export function ReservationDetail({ reservationId }: { reservationId: number }) {
  const { data: reservation, isLoading } = useReservation(reservationId)
  const { data: customer } = useCustomer(reservation?.customerId ?? 0)
  const { data: outlet } = useOutlet(reservation?.outletId ?? 0)
  const updateReservation = useUpdateReservation(reservationId)
  const updateStatus = useUpdateReservationStatus(reservationId)

  const form = useForm<UpdateReservationInput>({
    resolver: zodResolver(updateReservationSchema),
    values: reservation
      ? {
          reservedAt: reservation.reservedAt.slice(0, 16),
          guestCount: reservation.guestCount,
          source: reservation.source as UpdateReservationInput["source"],
          specialRequest: reservation.specialRequest ?? "",
          internalNote: reservation.internalNote ?? "",
          depositAmount: reservation.depositAmount,
        }
      : undefined,
  })

  async function onSubmit(values: UpdateReservationInput) {
    try {
      await updateReservation.mutateAsync({
        ...values,
        reservedAt: values.reservedAt ? new Date(values.reservedAt).toISOString() : undefined,
      })
      toast.success("Reservation updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update reservation")
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateStatus.mutateAsync(status)
      toast.success(`Status changed to ${status}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change status")
    }
  }

  if (isLoading || !reservation) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{customer?.name ?? `Customer #${reservation.customerId}`}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{outlet?.name ?? `Outlet #${reservation.outletId}`}</p>
            <Badge variant="secondary">{reservation.source}</Badge>
          </div>
        </div>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Button type="submit" disabled={updateReservation.isPending}>
                {updateReservation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
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

  async function handleAssign() {
    if (!selectedTableId) return
    try {
      await assignTable.mutateAsync({ diningTableId: Number(selectedTableId) })
      toast.success("Table assigned")
      setSelectedTableId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign table")
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
            <label className="text-sm font-medium">Assign a table</label>
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
          <Button onClick={handleAssign} disabled={!selectedTableId || assignTable.isPending}>
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
