"use client"

import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "@rms/ui/status-badge"
import { Skeleton } from "@rms/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rms/ui/table"
import { useTableSessions, type TableSession } from "@rms/api-client/hooks/use-table-sessions"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { StartTableSessionDialog } from "./start-table-session-dialog"

const columns: ColumnDef<TableSession>[] = [
  { accessorKey: "diningTableId", header: "Table #" },
  { accessorKey: "guestCount", header: "Guests" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export default function TableSessionsPage() {
  // Outlet is a global concept (see the header switcher) — this page just
  // follows whatever's currently active there instead of asking again.
  const { outletId } = useActiveOutlet()
  const { data, isLoading } = useTableSessions({
    limit: 100,
    outletId: outletId ?? undefined,
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
