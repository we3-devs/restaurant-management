"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { WalletIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCustomerCreditAccounts, type CustomerCreditAccount } from "@/hooks/use-customer-credit"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 10

export default function CustomerCreditPage() {
  const { permissions } = useCurrentUser()
  const canView = permissions.includes("customer-credit.view")

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [onlyOutstanding, setOnlyOutstanding] = useState(true)

  const { data, isLoading, isPlaceholderData } = useCustomerCreditAccounts({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const rows = useMemo(() => {
    const accounts = data?.data ?? []
    return onlyOutstanding ? accounts.filter((account) => account.outstandingBalance > 0) : accounts
  }, [data, onlyOutstanding])

  const columns = useMemo<ColumnDef<CustomerCreditAccount>[]>(
    () => [
      {
        id: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <Link href={`/dashboard/organization/customers/${row.original.customerId}`} className="font-medium hover:underline">
            {row.original.customerName ?? `Customer #${row.original.customerId}`}
          </Link>
        ),
      },
      {
        id: "customerPhone",
        header: "Phone",
        cell: ({ row }) => row.original.customerPhone ?? "—",
      },
      {
        id: "outstandingBalance",
        header: "Outstanding balance",
        cell: ({ row }) => (
          <span className={row.original.outstandingBalance > 0 ? "font-medium text-destructive" : "font-medium"}>
            {row.original.outstandingBalance.toFixed(2)}
          </span>
        ),
      },
      {
        id: "creditLimit",
        header: "Credit limit",
        cell: ({ row }) => row.original.creditLimit.toFixed(2),
      },
      {
        id: "overLimit",
        header: "Status",
        cell: ({ row }) =>
          row.original.outstandingBalance > row.original.creditLimit ? (
            <Badge variant="destructive">Over limit</Badge>
          ) : row.original.outstandingBalance > 0 ? (
            <Badge variant="outline">Outstanding</Badge>
          ) : (
            <Badge variant="secondary">Settled</Badge>
          ),
      },
      {
        id: "lifetimeCharged",
        header: "Lifetime charged",
        cell: ({ row }) => row.original.lifetimeCharged.toFixed(2),
      },
      {
        id: "lifetimeSettled",
        header: "Lifetime settled",
        cell: ({ row }) => row.original.lifetimeSettled.toFixed(2),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isEmpty = !isLoading && rows.length === 0

  usePageTitle("Customer Credit")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Customer Credit</h1>
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
            placeholder="Search customers..."
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            checked={onlyOutstanding}
            onCheckedChange={(checked) => setOnlyOutstanding(checked === true)}
          />
          Only show outstanding balances
        </label>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <WalletIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No outstanding credit</p>
          <p className="text-sm text-muted-foreground">
            Orders closed with the credit payment method will show up here until they're settled.
          </p>
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
