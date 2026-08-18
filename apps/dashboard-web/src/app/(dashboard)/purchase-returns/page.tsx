"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { Undo2Icon } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useIngredients } from "@/hooks/use-ingredients"
import { useOutlets } from "@/hooks/use-outlets"
import { useSuppliers } from "@/hooks/use-suppliers"
import {
  useCancelPurchaseReturn,
  useProcessPurchaseReturn,
  usePurchaseReturnItems,
  usePurchaseReturns,
  type PurchaseReturn,
} from "@/hooks/use-purchase-returns"
import { PURCHASE_RETURN_STATUSES } from "@/lib/validators/purchase-returns"
import { CreatePurchaseReturnDialog } from "./create-purchase-return-dialog"

const PAGE_SIZE = 10

export default function PurchaseReturnsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("purchase-returns.manage")

  const [outletFilter, setOutletFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [viewingId, setViewingId] = useState<number | null>(null)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data, isLoading, isPlaceholderData } = usePurchaseReturns({
    page,
    limit: PAGE_SIZE,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const processReturn = useProcessPurchaseReturn()
  const cancelReturn = useCancelPurchaseReturn()

  const supplierName = (id: number) => suppliers?.data.find((s) => s.id === id)?.companyName ?? `#${id}`

  async function handleProcess(id: number) {
    try {
      await processReturn.mutateAsync(id)
      toast.success("Purchase return processed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process return")
    }
  }

  async function handleCancel(id: number) {
    try {
      await cancelReturn.mutateAsync(id)
      toast.success("Purchase return cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel return")
    }
  }

  const columns = useMemo<ColumnDef<PurchaseReturn>[]>(
    () => [
      { id: "returnNo", header: "Return #", cell: ({ row }) => <span className="font-medium">{row.original.returnNo}</span> },
      { id: "poNo", header: "PO", cell: ({ row }) => `PO #${row.original.purchaseOrderId}` },
      { id: "supplier", header: "Supplier", cell: ({ row }) => supplierName(row.original.supplierId) },
      { id: "refundType", header: "Refund type", cell: ({ row }) => <Badge variant="outline">{row.original.refundType}</Badge> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} />
        ),
      },
      { id: "returnDate", header: "Return date", cell: ({ row }) => row.original.returnDate },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const ret = row.original
          return (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setViewingId(ret.id)}>
                View items
              </Button>
              {canManage && ret.status === "draft" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleProcess(ret.id)} disabled={processReturn.isPending}>
                    Process
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancel</Button>} />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel return {ret.returnNo}?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Back</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => handleCancel(ret.id)}>
                          Cancel return
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suppliers, canManage],
  )

  const table = useReactTable({ data: data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() })
  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Purchase Returns</h1>
        {canManage && <CreatePurchaseReturnDialog />}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by outlet</label>
          <Select value={outletFilter} onValueChange={(v) => { setOutletFilter(v ?? "all"); setPage(1) }}>
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
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PURCHASE_RETURN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
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
          <Undo2Icon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No purchase returns found</p>
          <p className="text-sm text-muted-foreground">Create a return against a purchase order to get started.</p>
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

      <Dialog open={viewingId !== null} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase return items</DialogTitle>
          </DialogHeader>
          {viewingId && <PurchaseReturnItemsList returnId={viewingId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PurchaseReturnItemsList({ returnId }: { returnId: number }) {
  const { data: items, isLoading } = usePurchaseReturnItems(returnId)
  const { data: ingredients } = useIngredients({ limit: 200 })
  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? `#${id}`

  if (isLoading) return <TableSkeleton rows={4} columns={5} />
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground">No items.</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Unit cost</TableHead>
          <TableHead>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{ingredientName(item.ingredientId)}</TableCell>
            <TableCell>{item.quantity}</TableCell>
            <TableCell>{item.unitCost.toFixed(2)}</TableCell>
            <TableCell>{item.totalCost.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
