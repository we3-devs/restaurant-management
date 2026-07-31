"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, TruckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlets } from "@/hooks/use-outlets"
import { useSupplierCategories, useSuppliers, type Supplier } from "@/hooks/use-suppliers"
import { SUPPLIER_STATUSES } from "@/lib/validators/suppliers"
import { CreateSupplierDialog } from "./create-supplier-dialog"

const PAGE_SIZE = 10

export default function SuppliersPage() {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("suppliers.manage")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [outletFilter, setOutletFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>([])

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: categories } = useSupplierCategories()
  const { data, isLoading, isPlaceholderData } = useSuppliers({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
  })

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        id: "companyName",
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.companyName}</p>
            <p className="text-xs text-muted-foreground">{row.original.supplierNo}</p>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => row.original.category?.name ?? "—",
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "secondary" : "outline"}>{row.original.status}</Badge>
        ),
      },
      {
        id: "outstandingBalance",
        accessorKey: "outstandingBalance",
        header: "Outstanding",
        cell: ({ row }) => {
          const supplier = row.original
          const overLimit = supplier.creditLimit > 0 && supplier.outstandingBalance > supplier.creditLimit
          return (
            <span className={overLimit ? "font-medium text-destructive" : undefined}>
              {supplier.outstandingBalance.toFixed(2)}
            </span>
          )
        },
      },
      {
        id: "creditLimit",
        accessorKey: "creditLimit",
        header: "Credit limit",
        cell: ({ row }) => row.original.creditLimit.toFixed(2),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Suppliers</h1>
        {canManage && <CreateSupplierDialog />}
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
            placeholder="Search suppliers..."
          />
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by outlet</label>
          <Select
            value={outletFilter}
            onValueChange={(value) => {
              setOutletFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All outlets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {outlets?.data.map((outlet) => (
                <SelectItem key={outlet.id} value={String(outlet.id)}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by category</label>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by status</label>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SUPPLIER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <TruckIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No suppliers found</p>
          <p className="text-sm text-muted-foreground">Create a supplier to get started.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDirection = header.column.getIsSorted()
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 select-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDirection === "asc" && <ArrowUpIcon className="size-3.5" />}
                            {sortDirection === "desc" && <ArrowDownIcon className="size-3.5" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/suppliers/${row.original.id}`)}
                >
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
