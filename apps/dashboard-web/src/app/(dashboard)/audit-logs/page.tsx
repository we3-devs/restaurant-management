"use client"

import { useMemo, useState } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { downloadAuditLogsExport, useAuditLogs, type AuditAction, type AuditLog } from "@/hooks/use-audit-logs"

const PAGE_SIZE = 15

const AUDIT_ACTIONS: AuditAction[] = [
  "login",
  "logout",
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "payment",
  "refund",
  "inventory_movement",
  "purchase_approval",
  "reservation_change",
  "settings_change",
  "role_change",
  "permission_change",
  "order_change",
  "kitchen_status_change",
]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return { dateFrom: isoDate(from), dateTo: isoDate(to) }
}

export default function AuditLogsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("audit-logs.view")

  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const params = {
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    ...range,
  }

  const { data, isLoading, isPlaceholderData } = useAuditLogs(params)

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      { id: "id", accessorKey: "id", header: "ID" },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge>,
      },
      { id: "entityType", accessorKey: "entityType", header: "Entity" },
      {
        id: "entityId",
        header: "Entity ID",
        cell: ({ row }) => row.original.entityId ?? "—",
      },
      {
        id: "userId",
        header: "User",
        cell: ({ row }) => row.original.userId ?? "—",
      },
      {
        id: "createdAt",
        header: "Created at",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  async function handleExport() {
    setExporting(true)
    try {
      await downloadAuditLogsExport(params)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Audit Logs</h1>
        <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
          <DownloadIcon /> {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search audit logs..."
          />
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by action</label>
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter
          value={range}
          onChange={(v) => {
            setRange(v)
            setPage(1)
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ScrollTextIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No audit logs found</p>
          <p className="text-sm text-muted-foreground">Try widening the date range or filters.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <DataTablePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
