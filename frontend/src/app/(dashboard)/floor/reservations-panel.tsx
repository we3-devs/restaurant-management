"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCustomers } from "@/hooks/use-customers"
import { useDiningTables } from "@/hooks/use-dining-tables"
import {
  useAssignReservationTable,
  useReservationTables,
  useReservations,
  useUpdateReservationStatus,
  type Reservation,
} from "@/hooks/use-reservations"

function isToday(dateString: string): boolean {
  const date = new Date(dateString)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function ReservationsPanel({ outletId }: { outletId: number }) {
  const { data: pending } = useReservations({ outletId, status: "pending", limit: 100 })
  const { data: confirmed } = useReservations({ outletId, status: "confirmed", limit: 100 })
  const { data: customers } = useCustomers({ limit: 100 })

  const todaysReservations = [...(pending?.data ?? []), ...(confirmed?.data ?? [])]
    .filter((reservation) => isToday(reservation.reservedAt))
    .sort((a, b) => a.reservedAt.localeCompare(b.reservedAt))

  const customerName = (customerId: number) =>
    customers?.data.find((c) => c.id === customerId)?.name ?? `#${customerId}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s reservations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {todaysReservations.length === 0 && (
          <p className="text-sm text-muted-foreground">No reservations for today.</p>
        )}
        {todaysReservations.map((reservation) => (
          <ReservationRow
            key={reservation.id}
            reservation={reservation}
            outletId={outletId}
            customerName={customerName(reservation.customerId)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function ReservationRow({
  reservation,
  outletId,
  customerName,
}: {
  reservation: Reservation
  outletId: number
  customerName: string
}) {
  const { data: tables } = useReservationTables(reservation.id)
  const { data: availableTables } = useDiningTables({ outletId, status: "available", limit: 100 })
  const assignTable = useAssignReservationTable(reservation.id)
  const updateStatus = useUpdateReservationStatus(reservation.id)
  const [tableId, setTableId] = useState("")

  const hasTable = (tables?.length ?? 0) > 0

  async function handleCheckIn() {
    try {
      if (!hasTable) {
        if (!tableId) {
          toast.error("Assign a table first")
          return
        }
        await assignTable.mutateAsync({ diningTableId: Number(tableId) })
      }
      await updateStatus.mutateAsync("seated")
      toast.success(`${customerName} checked in`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check in")
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-input p-2.5">
      <div>
        <p className="text-sm font-medium">{customerName}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {new Date(reservation.reservedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &middot;{" "}
            {reservation.guestCount} guests
          </span>
          <Badge variant="secondary" className="text-xs">
            {reservation.status}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {!hasTable && (
          <Select value={tableId} onValueChange={(value) => setTableId(value ?? "")}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Table" />
            </SelectTrigger>
            <SelectContent>
              {availableTables?.data.map((table) => (
                <SelectItem key={table.id} value={String(table.id)}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          onClick={handleCheckIn}
          disabled={assignTable.isPending || updateStatus.isPending}
        >
          Check in
        </Button>
      </div>
    </div>
  )
}
