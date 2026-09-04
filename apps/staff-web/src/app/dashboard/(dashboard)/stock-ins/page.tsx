"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@/components/status-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useStockIns, type StockIn } from "@/hooks/use-stock-ins"
import { useWarehouses } from "@/hooks/use-warehouses"
import { CreateStockInDialog } from "./create-stock-in-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const columns: ColumnDef<StockIn>[] = [
  { accessorKey: "stockInNo", header: "Number" },
  { accessorKey: "stockInDate", header: "Date" },
  { accessorKey: "source", header: "Source" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} />
    ),
  },
]

export default function StockInsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data, isLoading } = useStockIns({
    limit: 100,
    warehouseId: warehouseFilter !== "all" ? Number(warehouseFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Stock-Ins")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stock-Ins</h1>
        <CreateStockInDialog />
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Filter by warehouse</label>
        <Select value={warehouseFilter} onValueChange={(value) => setWarehouseFilter(value ?? "all")}>
          <SelectTrigger className="w-full">
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
                    <Link href={`/dashboard/stock-ins/${row.original.id}`} className="block">
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
