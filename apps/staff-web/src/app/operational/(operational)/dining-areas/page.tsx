"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@rms/ui/badge"
import { TableSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useDiningAreas, type DiningArea } from "@rms/api-client/hooks/use-dining-areas"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { CreateDiningAreaDialog } from "./create-dining-area-dialog"

const columns: ColumnDef<DiningArea>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "code", header: "Code" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (!row.original.isActive ? <Badge variant="destructive">inactive</Badge> : null),
  },
]

export default function DiningAreasPage() {
  const pathname = usePathname()
  // Mounted at several routes (operational floor management, dashboard's
  // editable dining-area list, dashboard's read-only "view" list) — derive
  // the base path from wherever it's actually rendered instead of
  // hardcoding one, so row links stay on the same route family.
  const basePath = pathname || "/operational/dining-areas"
  const { outletId } = useActiveOutlet()
  const { data, isLoading } = useDiningAreas({ limit: 100, outletId: outletId ?? undefined })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dining Areas</h1>
        <CreateDiningAreaDialog />
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
                    <Link href={`${basePath}/${row.original.id}`} className="block">
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
