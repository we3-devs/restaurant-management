"use client"

import { useMemo } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@rms/ui/status-badge"
import { TableSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables, type DiningTable } from "@rms/api-client/hooks/use-dining-tables"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { CreateDiningTableDialog } from "./create-dining-table-dialog"

export default function DiningTablesPage() {
  const { outletId } = useActiveOutlet()
  const { data, isLoading } = useDiningTables({
    limit: 100,
    outletId: outletId ?? undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: areas } = useDiningAreas({ limit: 100, outletId: outletId ?? undefined })

  const areaName = (diningAreaId: number) =>
    areas?.data.find((area) => area.id === diningAreaId)?.name ?? "Loading…"

  const columns = useMemo<ColumnDef<DiningTable>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        id: "diningArea",
        header: "Dining Area",
        cell: ({ row }) => areaName(row.original.diningAreaId),
      },
      { accessorKey: "capacity", header: "Capacity" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dining Tables</h1>
        <CreateDiningTableDialog />
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
                    <Link href={`/operational/dining-tables/${row.original.id}`} className="block">
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
