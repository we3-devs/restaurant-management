"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useOutlets } from "@/hooks/use-outlets"
import { useTableSessions, type TableSession } from "@/hooks/use-table-sessions"
import { StartTableSessionDialog } from "./start-table-session-dialog"

const columns: ColumnDef<TableSession>[] = [
  { accessorKey: "diningTableId", header: "Table #" },
  { accessorKey: "guestCount", header: "Guests" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
]

export default function TableSessionsPage() {
  const [outletFilter, setOutletFilter] = useState<string>("all")
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data, isLoading } = useTableSessions({
    limit: 100,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
  })

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Table Sessions</h1>
        <StartTableSessionDialog />
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
                    <Link href={`/table-sessions/${row.original.id}`} className="block">
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
