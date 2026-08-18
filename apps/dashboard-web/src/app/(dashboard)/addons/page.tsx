"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import { useAddons, type Addon } from "@/hooks/use-addons"
import { CreateAddonDialog } from "./create-addon-dialog"

const columns: ColumnDef<Addon>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "price", header: "Price" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (!row.original.isActive ? <Badge variant="destructive">inactive</Badge> : null),
  },
]

export default function AddonsPage() {
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const { data: addonGroups } = useAddonGroups({ limit: 100 })
  const { data, isLoading } = useAddons({
    limit: 100,
    addonGroupId: groupFilter !== "all" ? Number(groupFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Addons</h1>
        <CreateAddonDialog />
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Filter by addon group</label>
        <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All addon groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All addon groups</SelectItem>
            {addonGroups?.data.map((group) => (
              <SelectItem key={group.id} value={String(group.id)}>
                {group.name}
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
                    <Link href={`/addons/${row.original.id}`} className="block">
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
