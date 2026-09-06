"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@/components/status-badge"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { DataTablePagination } from "@/components/data-table-pagination"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useOrders, type Order } from "@/hooks/use-orders"
import { useCustomers } from "@/hooks/use-customers"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { ORDER_STATUSES } from "@/lib/validators/orders"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 20
const defaultRange = (): DateRange => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 29); return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) } }

const createColumns = (customerNameFor: (order: Order) => string): ColumnDef<Order>[] => [
  { accessorKey: "orderNumber", header: "Order #" },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const name = customerNameFor(row.original)
      return (
        <span className="block w-[220px] max-w-[220px] truncate" title={name}>
          {name}
        </span>
      )
    },
  },
  { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "paymentStatus", header: "Payment", cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
  { id: "orderType", header: "Type", cell: ({ row }) => <span className="capitalize">{row.original.orderType.replaceAll("_", " ")}</span> },
  { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  { accessorKey: "grandTotal", header: "Total" },
]
/** Read-only order status tracking for admin — no create/edit here, that stays in operational-web/POS. */
export default function OrdersTrackingPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [range, setRange] = useState<DateRange>(defaultRange)
  const { outletId } = useActiveOutlet()
  const { data: customers } = useCustomers({ limit: 500 })
  const { data: tableSessions } = useTableSessions({ outletId: outletId ?? undefined, limit: 500 })
  const customerNameFor = useMemo(() => {
    const customerById = new Map((customers?.data ?? []).map((customer) => [customer.id, customer.name]))
    const sessionById = new Map((tableSessions?.data ?? []).map((session) => [session.id, session]))
    return (order: Order) => {
      const session = order.tableSessionId ? sessionById.get(order.tableSessionId) : undefined
      const names = session?.customers?.map((customer) => customer.name).filter(Boolean) ?? []
      return names.length > 0 ? names.join(", ") : (order.customerId ? customerById.get(order.customerId) : undefined) ?? "Walk-in customer"
    }
  }, [customers?.data, tableSessions?.data])
  const columns = useMemo(() => createColumns(customerNameFor), [customerNameFor])
  const { data, isLoading, isPlaceholderData } = useOrders({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    outletId: outletId ?? undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    createdFrom: range.dateFrom,
    createdTo: range.dateTo,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Orders")

  return (
    <div className="page-shell space-y-7">
      <div className="">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <DateRangeFilter value={range} onChange={(value) => { setRange(value); setPage(1) }} />
        <div className="w-full space-y-1.5 sm:max-w-md">
          <label htmlFor="order-search" className="text-sm font-medium">Search orders or customers</label>
          <Input
            id="order-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search order number or customer"
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-64">
          <label htmlFor="order-status" className="text-sm font-medium">Filter by status</label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger id="order-status" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm ${isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/orders/${row.original.id}`)}
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
