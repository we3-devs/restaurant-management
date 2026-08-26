"use client"

import { useMemo, useState } from "react"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table"
import { ReceiptTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCustomers } from "@/hooks/use-customers"
import { useLoyaltyTransactions, type LoyaltyTransaction } from "@/hooks/use-loyalty"
import { LOYALTY_TRANSACTION_TYPES } from "@/lib/validators/loyalty"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 15

const POSITIVE_TYPES = new Set(["earn", "refund_reversal"])
const NEGATIVE_TYPES = new Set(["redeem", "expiry"])

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return { dateFrom: isoDate(from), dateTo: isoDate(to) }
}

function typeBadgeVariant(type: string): "secondary" | "destructive" | "outline" {
  if (POSITIVE_TYPES.has(type)) return "secondary"
  if (NEGATIVE_TYPES.has(type)) return "destructive"
  return "outline"
}

export default function LoyaltyTransactionsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("loyalty.view")

  const [typeFilter, setTypeFilter] = useState("all")
  const [customerId, setCustomerId] = useState("")
  const [range, setRange] = useState(defaultRange)
  const [page, setPage] = useState(1)

  const params = {
    page,
    limit: PAGE_SIZE,
    type: typeFilter !== "all" ? typeFilter : undefined,
    customerId: customerId ? Number(customerId) : undefined,
    ...range,
  }

  const { data, isLoading, isPlaceholderData } = useLoyaltyTransactions(params)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: customers } = useCustomers({ limit: 100 })
  const customerName = (id: number) => customers?.data.find((c) => c.id === id)?.name ?? "Loading…"

  const columns = useMemo<ColumnDef<LoyaltyTransaction>[]>(
    () => [
      {
        id: "createdAt",
        header: "Date",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        id: "customerId",
        header: "Customer",
        cell: ({ row }) => customerName(row.original.customerId),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => <Badge variant={typeBadgeVariant(row.original.type)}>{row.original.type}</Badge>,
      },
      {
        id: "points",
        header: "Points",
        cell: ({ row }) => {
          const points = row.original.points
          return (
            <span className={points < 0 ? "text-destructive" : "text-foreground"}>
              {points > 0 ? `+${points}` : points}
            </span>
          )
        },
      },
      {
        id: "balanceAfter",
        accessorKey: "balanceAfter",
        header: "Balance after",
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => row.original.source ?? "—",
      },
      {
        id: "orderId",
        header: "Order",
        cell: ({ row }) => (row.original.orderId ? `#${row.original.orderId}` : "—"),
      },
      {
        id: "notes",
        header: "Notes",
        cell: ({ row }) => row.original.notes ?? "—",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  usePageTitle("Loyalty Transactions")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Loyalty Transactions</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-40 space-y-1.5">
          <label className="text-sm font-medium">Customer ID</label>
          <Input
            type="number"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setPage(1)
            }}
            placeholder="Any customer"
          />
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by type</label>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {LOYALTY_TRANSACTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
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

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ReceiptTextIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No transactions found</p>
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
