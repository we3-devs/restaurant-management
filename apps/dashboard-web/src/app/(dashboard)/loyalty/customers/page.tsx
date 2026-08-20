"use client"

import { useMemo, useState } from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { AwardIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useLoyaltyAccounts, type LoyaltyAccount } from "@/hooks/use-loyalty"
import { AdjustLoyaltyPointsDialog } from "./adjust-loyalty-points-dialog"

const PAGE_SIZE = 10

export default function LoyaltyCustomersPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("loyalty.view")
  const canManage = isSuperadmin || permissions.includes("loyalty.manage")

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading, isPlaceholderData } = useLoyaltyAccounts({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const columns = useMemo<ColumnDef<LoyaltyAccount>[]>(
    () => [
      {
        id: "customerName",
        header: "Customer",
        cell: ({ row }) => row.original.customerName ?? "Loading…",
      },
      {
        id: "currentPoints",
        accessorKey: "currentPoints",
        header: "Current points",
      },
      {
        id: "lifetimeEarned",
        accessorKey: "lifetimeEarned",
        header: "Lifetime earned",
      },
      {
        id: "lifetimeRedeemed",
        accessorKey: "lifetimeRedeemed",
        header: "Lifetime redeemed",
      },
      {
        id: "expiringPoints",
        accessorKey: "expiringPoints",
        header: "Expiring points",
      },
      {
        id: "tier",
        header: "Tier",
        cell: ({ row }) =>
          row.original.tier ? <Badge variant="outline">{row.original.tier}</Badge> : "—",
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

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Loyalty Customers</h1>
        {canManage && <AdjustLoyaltyPointsDialog />}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search customers..."
          />
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <AwardIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No loyalty accounts found</p>
          <p className="text-sm text-muted-foreground">Accounts are created automatically as customers earn points.</p>
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
