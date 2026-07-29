"use client"

import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRoles, type Role } from "@/hooks/use-roles"
import { CreateRoleDialog } from "./create-role-dialog"

const columns: ColumnDef<Role>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "slug", header: "Slug" },
  { accessorKey: "rank", header: "Rank" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.isSystem && <Badge variant="secondary">system</Badge>}
        {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
      </div>
    ),
  },
]

export default function RolesPage() {
  const { data, isLoading } = useRoles({ limit: 100 })

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Roles</h1>
        <CreateRoleDialog />
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
                    <Link href={`/roles/${row.original.id}`} className="block">
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
