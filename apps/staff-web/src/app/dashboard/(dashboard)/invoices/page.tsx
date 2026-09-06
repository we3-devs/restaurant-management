"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DownloadIcon } from "lucide-react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { DataTablePagination } from "@/components/data-table-pagination"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useOrders, type Order } from "@/hooks/use-orders"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 20
const defaultRange = (): DateRange => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 29); return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) } }
function orderDateRange(range: DateRange) { const from = new Date(`${range.dateFrom}T00:00:00`); const to = new Date(`${range.dateTo}T00:00:00`); to.setDate(to.getDate() + 1); return { createdFrom: from.toISOString(), createdTo: to.toISOString() } }

const columns: ColumnDef<Order>[] = [
  { accessorKey: "invoiceNumber", header: "Invoice #" },
  { accessorKey: "orderNumber", header: "Order #" },
  {
    id: "status",
    header: "Order Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "grandTotal", header: "Total" },
  {
    id: "invoiceGeneratedAt",
    header: "Invoice Date",
    cell: ({ row }) =>
      row.original.invoiceGeneratedAt ? new Date(row.original.invoiceGeneratedAt).toLocaleString() : "N/A",
  },
  {
    id: "createdAt",
    header: "Order Date",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
]

export default function InvoicesPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [range, setRange] = useState<DateRange>(defaultRange)
  const { outletId } = useActiveOutlet()
  const { data, isLoading, isPlaceholderData } = useOrders({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    ...orderDateRange(range),
    outletId: outletId ?? undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const invoices = data?.data?.filter((order) => order.invoiceNumber) ?? []
  function exportInvoices() {
    const values = invoices.map((invoice) => [invoice.invoiceNumber, invoice.orderNumber, invoice.status, invoice.grandTotal, invoice.invoiceGeneratedAt ?? "", invoice.createdAt])
    const csv = [["Invoice", "Order", "Status", "Total", "Invoice date", "Order date"], ...values].map((row) => row.join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "invoices.csv"; link.click(); URL.revokeObjectURL(url)
  }

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Invoices")

  return (
    <div className="page-shell space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Invoices</h1>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm"><DateRangeFilter compact value={range} onChange={(value) => { setRange(value); setPage(1) }} /><Button variant="outline" size="sm" disabled={invoices.length === 0} onClick={exportInvoices}><DownloadIcon /> Export CSV</Button></div>
      </div>
      <div className="max-w-md"><Input className="h-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search invoices or orders..." /></div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm ${isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
          {invoices.length > 0 ? (
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
                    onClick={() => router.push(`/dashboard/invoices/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No invoices generated yet</p>
            </div>
          )}
        </div>
      )}

      {data && invoices.length > 0 && (
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
