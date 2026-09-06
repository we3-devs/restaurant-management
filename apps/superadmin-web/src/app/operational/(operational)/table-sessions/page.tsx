"use client"

import { useMemo } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@rms/ui/status-badge"
import { TableSkeleton } from "@rms/ui/skeletons"
import { useDelayedLoading } from "@rms/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { tableSessionName, useTableSessions, type TableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { StartTableSessionDialog } from "./start-table-session-dialog"

export default function TableSessionsPage() {
  // Outlet is a global concept (see the header switcher) — this page just
  // follows whatever's currently active there instead of asking again.
  const { outletId } = useActiveOutlet()
  const { data, isLoading } = useTableSessions({
    limit: 100,
    outletId: outletId ?? undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: diningTables } = useDiningTables({ limit: 200, outletId: outletId ?? undefined })
  const tableName = (id: number) => diningTables?.data.find((t) => t.id === id)?.name ?? "Loading…"

  const columns = useMemo<ColumnDef<TableSession>[]>(
    () => [
      { id: "session", header: "Session", cell: ({ row }) => tableSessionName(row.original) },
      { id: "diningTableId", header: "Table", cell: ({ row }) => tableName(row.original.diningTableId) },
      { accessorKey: "guestCount", header: "Guests" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diningTables],
  )

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
                    <Link href={`/operational/table-sessions/${row.original.id}`} className="block">
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
