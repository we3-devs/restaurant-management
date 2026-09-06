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
import { ArrowDownIcon, ArrowUpIcon, ClipboardListIcon } from "lucide-react"

import { StatusBadge } from "@rms/ui/status-badge"
import { TableSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { tableSessionName, useTableSessions, type TableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useOrders, type Order } from "@rms/api-client/hooks/use-orders"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { CreateOrderDialog } from "./create-order-dialog"

/** Same calendar day as `now`, in the browser's local timezone. */
function isToday(isoDate: string): boolean {
  const date = new Date(isoDate)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

interface OrderRow {
  order: Order
  tableName: string
  customerName: string
  sessionLabel: string
}

export default function OrdersPage() {
  const router = useRouter()
  const { outletId } = useActiveOutlet()
  const [sorting, setSorting] = useState<SortingState>([])

  // Every order/session/table/customer for the outlet, filtered to today
  // client-side — the list endpoint has no date filter and a single day's
  // volume is small enough this is cheap.
  const { data: orders, isLoading } = useOrders({ outletId: outletId ?? undefined, limit: 200 })
  const { data: sessions } = useTableSessions({ outletId: outletId ?? undefined, limit: 200 })
  const { data: customers } = useCustomers({ limit: 200 })
  const showSkeleton = useDelayedLoading(isLoading)

  const rows = useMemo<OrderRow[]>(() => {
    const sessionById = new Map<number, TableSession>((sessions?.data ?? []).map((s) => [s.id, s]))
    const customerNameById = new Map<number, string>((customers?.data ?? []).map((c) => [c.id, c.name]))

    return (orders?.data ?? [])
      .filter((order) => isToday(order.createdAt))
      .map((order) => {
        const session = order.tableSessionId ? sessionById.get(order.tableSessionId) : undefined
        const tableName = order.tableName ?? order.orderType.replace(/_/g, " ")
        const customerName = order.customerId
          ? (customerNameById.get(order.customerId) ?? "Loading…")
          : (session?.customer?.name ?? "Walk-in")
        const sessionLabel = session ? tableSessionName(session) : "—"
        return { order, tableName, customerName, sessionLabel }
      })
  }, [orders, sessions, customers])

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      { id: "table", header: "Table", accessorFn: (row) => row.tableName },
      { id: "customer", header: "Customer", accessorFn: (row) => row.customerName },
      { id: "session", header: "Session", accessorFn: (row) => row.sessionLabel },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.order.status,
        cell: ({ row }) => <StatusBadge status={row.original.order.status} />,
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (row) => row.order.grandTotal,
      },
      {
        id: "placedAt",
        header: "Placed",
        accessorFn: (row) => row.order.createdAt,
        cell: ({ row }) => new Date(row.original.order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { sorting: [{ id: "placedAt", desc: true }] },
  })

  const isEmpty = !isLoading && rows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Today&apos;s orders</h1>
        <CreateOrderDialog />
      </div>

      {!outletId && <p className="text-sm text-muted-foreground">Select an outlet to view orders.</p>}

      {outletId && showSkeleton && <TableSkeleton rows={8} columns={columns.length} />}

      {outletId && isEmpty && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ClipboardListIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No orders yet today</p>
        </div>
      )}

      {outletId && !showSkeleton && !isEmpty && (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.column.getCanSort() ? (
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
                onClick={() => router.push(`/operational/orders/${row.original.order.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
