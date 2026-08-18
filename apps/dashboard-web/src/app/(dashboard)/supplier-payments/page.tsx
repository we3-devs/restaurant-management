"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { WalletIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlets } from "@/hooks/use-outlets"
import { useSuppliers } from "@/hooks/use-suppliers"
import {
  useCancelSupplierPayment,
  useSupplierPayments,
  type SupplierPayment,
} from "@/hooks/use-supplier-payments"
import { PAYMENT_METHODS } from "@/lib/validators/supplier-payments"
import { CreateSupplierPaymentDialog } from "./create-supplier-payment-dialog"

const PAGE_SIZE = 10

export default function SupplierPaymentsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("supplier-payments.manage")

  const [supplierFilter, setSupplierFilter] = useState("all")
  const [outletFilter, setOutletFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [page, setPage] = useState(1)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data, isLoading, isPlaceholderData } = useSupplierPayments({
    page,
    limit: PAGE_SIZE,
    supplierId: supplierFilter !== "all" ? Number(supplierFilter) : undefined,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
    paymentMethod: methodFilter !== "all" ? methodFilter : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const cancelPayment = useCancelSupplierPayment()

  const supplierName = (id: number) => suppliers?.data.find((s) => s.id === id)?.companyName ?? `#${id}`

  async function handleCancel(id: number) {
    try {
      await cancelPayment.mutateAsync(id)
      toast.success("Payment cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel payment")
    }
  }

  const columns = useMemo<ColumnDef<SupplierPayment>[]>(
    () => [
      {
        id: "paymentNo",
        header: "Payment #",
        cell: ({ row }) => <span className="font-medium">{row.original.paymentNo}</span>,
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: ({ row }) => supplierName(row.original.supplierId),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => row.original.amount.toFixed(2),
      },
      {
        id: "paymentMethod",
        header: "Method",
        cell: ({ row }) => <Badge variant="outline">{row.original.paymentMethod}</Badge>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} />
        ),
      },
      {
        id: "paymentDate",
        header: "Date",
        cell: ({ row }) => row.original.paymentDate,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const payment = row.original
          if (!canManage || payment.status === "cancelled") return null
          return (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancel</Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel payment {payment.paymentNo}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This reverses the payment&apos;s effect on the supplier&apos;s outstanding balance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => handleCancel(payment.id)}>
                    Cancel payment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suppliers, canManage],
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
        <h1 className="text-lg font-semibold">Supplier Payments</h1>
        {canManage && <CreateSupplierPaymentDialog />}
      </div>

      <div className="flex flex-wrap gap-4">
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
          <label className="text-sm font-medium">Filter by method</label>
          <Select value={methodFilter} onValueChange={(value) => { setMethodFilter(value ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <WalletIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No supplier payments found</p>
          <p className="text-sm text-muted-foreground">Record a payment to get started.</p>
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
