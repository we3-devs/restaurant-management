"use client"

import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlets, type Outlet } from "@/hooks/use-outlets"
import {
  usePeriodInsightsBackfillStatus,
  useStartPeriodInsightsBackfill,
} from "@/hooks/use-period-insights"
import { CreateOutletDialog } from "./create-outlet-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const columns: ColumnDef<Outlet>[] = [{ accessorKey: "name", header: "Name" }]

export default function OutletsPage() {
  const user = useCurrentUser()
  const { data, isLoading } = useOutlets({ limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  const { data: backfillStatus } = usePeriodInsightsBackfillStatus({
    enabled: user.isSuperadmin,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  })
  const startBackfill = useStartPeriodInsightsBackfill()
  const isBackfillRunning = backfillStatus?.running ?? false

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Outlets")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Outlets</h1>
        <div className="flex items-center gap-3">
          {user.isSuperadmin && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBackfillRunning || startBackfill.isPending}
              onClick={() => {
                startBackfill.mutate(undefined, {
                  onSuccess: () =>
                    toast.info("Processing all historical orders into insights — this runs in the background."),
                  onError: (error) =>
                    toast.error(error instanceof Error ? error.message : "Failed to start backfill"),
                })
              }}
            >
              {isBackfillRunning ? "Processing history…" : "Process all old data"}
            </Button>
          )}
          <CreateOutletDialog />
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">No outlets yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first outlet to start taking orders, managing tables, and tracking inventory.
          </p>
          <CreateOutletDialog />
        </div>
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
                    <Link href={`/dashboard/outlets/${row.original.id}`} className="block">
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
