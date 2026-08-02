"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, CalendarIcon, MoreHorizontalIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCustomers } from "@/hooks/use-customers"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useReservations, useReservationTables, type Reservation } from "@/hooks/use-reservations"
import { useReservationsBootstrap } from "@/hooks/use-bootstrap"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { RESERVATION_STATUSES } from "@/lib/validators/reservations"
import { CreateReservationDialog } from "./create-reservation-dialog"

const PAGE_SIZE = 10

/** Resolves a reservation's assigned table name(s) — a reservation can have more than one. */
function ReservationTableCell({ reservationId, outletId }: { reservationId: number; outletId: number }) {
  const { data: assignments } = useReservationTables(reservationId)
  const { data: tables } = useDiningTables({ outletId, limit: 100 })

  if (!assignments || assignments.length === 0) {
    return <span className="text-muted-foreground">Unassigned</span>
  }
  return (
    <>
      {assignments
        .map((assignment) => tables?.data.find((t) => t.id === assignment.diningTableId)?.name ?? `#${assignment.diningTableId}`)
        .join(", ")}
    </>
  )
}

export default function ReservationsPage() {
  const router = useRouter()
  const { outletId } = useActiveOutlet()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>([])

  // One request for outlets + customers (+ a first page of reservations)
  // instead of two separate ones; seeds the caches the hooks below read from.
  useReservationsBootstrap()
  const { data: customers } = useCustomers({ limit: 100 })
  const { data, isLoading, isPlaceholderData } = useReservations({
    page,
    limit: PAGE_SIZE,
    outletId: outletId ?? undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })

  const customerName = (customerId: number) =>
    customers?.data.find((c) => c.id === customerId)?.name ?? `#${customerId}`
  const customerPhone = (customerId: number) => customers?.data.find((c) => c.id === customerId)?.phone ?? "—"

  const columns = useMemo<ColumnDef<Reservation>[]>(
    () => [
      {
        accessorKey: "reservedAt",
        header: "Time",
        cell: ({ row }) => new Date(row.original.reservedAt).toLocaleString(),
      },
      {
        id: "table",
        header: "Table",
        cell: ({ row }) => (
          <ReservationTableCell reservationId={row.original.id} outletId={row.original.outletId} />
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => <p className="font-medium">{customerName(row.original.customerId)}</p>,
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => customerPhone(row.original.customerId),
      },
      { accessorKey: "guestCount", header: "Guests" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      { accessorKey: "source", header: "Source" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/reservations/${row.original.id}`)}>
                  View details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, customers],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reservations</h1>
        <CreateReservationDialog />
      </div>

      <div className="flex gap-4">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Filter by status</label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {RESERVATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <CalendarIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No reservations found</p>
          <p className="text-sm text-muted-foreground">Create a reservation to get started.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDirection = header.column.getIsSorted()
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 select-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDirection === "asc" && <ArrowUpIcon className="size-3.5" />}
                            {sortDirection === "desc" && <ArrowDownIcon className="size-3.5" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/reservations/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <DataTablePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
