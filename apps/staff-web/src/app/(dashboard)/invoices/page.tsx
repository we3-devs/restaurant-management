"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { DataTablePagination } from "@/components/data-table-pagination"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useOrders, type Order } from "@/hooks/use-orders"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 20

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
  const { outletId } = useActiveOutlet()
  const { data, isLoading, isPlaceholderData } = useOrders({
    page,
    limit: PAGE_SIZE,
    outletId: outletId ?? undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const invoices = data?.data?.filter((order) => order.invoiceNumber) ?? []

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Invoices")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {data?.meta?.total ? `${invoices.length} of ${data.meta.total} orders have invoices` : ""}
        </p>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
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
                    onClick={() => router.push(`/invoices/${row.original.id}`)}
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
