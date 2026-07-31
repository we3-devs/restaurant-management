"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { ClipboardListIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlets } from "@/hooks/use-outlets"
import { useSuppliers } from "@/hooks/use-suppliers"
import { usePurchaseOrders, type PurchaseOrder } from "@/hooks/use-purchase-orders"
import { PURCHASE_ORDER_STATUSES } from "@/lib/validators/purchase-orders"
import { CreatePurchaseOrderDialog } from "./create-purchase-order-dialog"

const PAGE_SIZE = 10

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "secondary",
  partially_received: "secondary",
  received: "secondary",
  completed: "secondary",
  cancelled: "destructive",
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("purchase-orders.manage")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [outletFilter, setOutletFilter] = useState("all")
  const [page, setPage] = useState(1)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data, isLoading, isPlaceholderData } = usePurchaseOrders({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    supplierId: supplierFilter !== "all" ? Number(supplierFilter) : undefined,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
  })

  const supplierName = (id: number) => suppliers?.data.find((s) => s.id === id)?.companyName ?? `#${id}`

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      { id: "poNo", header: "PO #", cell: ({ row }) => <span className="font-medium">{row.original.poNo}</span> },
      { id: "supplier", header: "Supplier", cell: ({ row }) => supplierName(row.original.supplierId) },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
            {row.original.status.replaceAll("_", " ")}
          </Badge>
        ),
      },
      {
        id: "expectedDeliveryDate",
        header: "Expected delivery",
        cell: ({ row }) => row.original.expectedDeliveryDate ?? "—",
      },
      { id: "grandTotal", header: "Grand total", cell: ({ row }) => row.original.grandTotal.toFixed(2) },
      {
        id: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suppliers],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Purchase Orders</h1>
        {canManage && <CreatePurchaseOrderDialog />}
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
            placeholder="Search by PO #..."
          />
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by supplier</label>
          <Select value={supplierFilter} onValueChange={(value) => { setSupplierFilter(value ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers?.data.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by outlet</label>
          <Select value={outletFilter} onValueChange={(value) => { setOutletFilter(value ?? "all"); setPage(1) }}>
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
          <label className="text-sm font-medium">Filter by status</label>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PURCHASE_ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replaceAll("_", " ")}
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
          <ClipboardListIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No purchase orders found</p>
          <p className="text-sm text-muted-foreground">Create a purchase order to get started.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/purchase-orders/${row.original.id}`)}
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
