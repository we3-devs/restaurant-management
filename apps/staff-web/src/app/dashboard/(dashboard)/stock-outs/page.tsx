"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@/components/status-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useStockOuts, type StockOut } from "@/hooks/use-stock-outs"
import { useWarehouses } from "@/hooks/use-warehouses"
import { CreateStockOutDialog } from "./create-stock-out-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const columns: ColumnDef<StockOut>[] = [
  { accessorKey: "stockOutNo", header: "Number" },
  { accessorKey: "stockOutDate", header: "Date" },
  { accessorKey: "purpose", header: "Purpose" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} />
    ),
  },
]

export default function StockOutsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data, isLoading } = useStockOuts({
    limit: 100,
    warehouseId: warehouseFilter !== "all" ? Number(warehouseFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Stock-Outs")

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stock-Outs</h1>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
        <Select value={warehouseFilter} onValueChange={(value) => setWarehouseFilter(value ?? "all")}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses?.data.map((warehouse) => (
              <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          <CreateStockOutDialog />
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
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
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <Link href={`/dashboard/stock-outs/${row.original.id}`} className="block">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
