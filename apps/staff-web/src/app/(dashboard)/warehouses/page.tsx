"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useOutlets } from "@/hooks/use-outlets"
import { useWarehouses, type Warehouse } from "@/hooks/use-warehouses"
import { CreateWarehouseDialog } from "./create-warehouse-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const columns: ColumnDef<Warehouse>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "code", header: "Code" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.isDefault && <Badge variant="secondary">default</Badge>}
        {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
      </div>
    ),
  },
]

export default function WarehousesPage() {
  const [outletFilter, setOutletFilter] = useState<string>("all")
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data, isLoading } = useWarehouses({
    limit: 100,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Warehouses")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Warehouses</h1>
        <CreateWarehouseDialog />
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Filter by outlet</label>
        <Select value={outletFilter} onValueChange={(value) => setOutletFilter(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All outlets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outlets</SelectItem>
            {outlets?.data.map((outlet) => (
              <SelectItem key={outlet.id} value={String(outlet.id)}>
                {outlet.name}
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
                    <Link href={`/warehouses/${row.original.id}`} className="block">
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
