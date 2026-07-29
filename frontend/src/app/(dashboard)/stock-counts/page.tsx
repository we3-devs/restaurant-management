"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useStockCounts, type StockCount } from "@/hooks/use-stock-counts"
import { useWarehouses } from "@/hooks/use-warehouses"
import { CreateStockCountDialog } from "./create-stock-count-dialog"

const columns: ColumnDef<StockCount>[] = [
  { accessorKey: "countNo", header: "Number" },
  { accessorKey: "countDate", header: "Date" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "adjusted" ? "secondary" : "outline"}>{row.original.status}</Badge>
    ),
  },
]

export default function StockCountsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data, isLoading } = useStockCounts({
    limit: 100,
    warehouseId: warehouseFilter !== "all" ? Number(warehouseFilter) : undefined,
  })

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stock Counts</h1>
        <CreateStockCountDialog />
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

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
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
                    <Link href={`/stock-counts/${row.original.id}`} className="block">
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
