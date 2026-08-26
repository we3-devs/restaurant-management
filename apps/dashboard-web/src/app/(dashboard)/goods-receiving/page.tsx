"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { PackageCheckIcon } from "lucide-react"

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
  useCancelGoodsReceiving,
  useGoodsReceivingItems,
  useGoodsReceivingList,
  type GoodsReceiving,
} from "@/hooks/use-goods-receiving"
import { CreateGoodsReceivingDialog } from "./create-goods-receiving-dialog"

const PAGE_SIZE = 10

export default function GoodsReceivingPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("goods-receiving.manage")

  const [outletFilter, setOutletFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [viewingId, setViewingId] = useState<number | null>(null)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data, isLoading, isPlaceholderData } = useGoodsReceivingList({
    page,
    limit: PAGE_SIZE,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const cancelGrn = useCancelGoodsReceiving()

  const supplierName = (id: number) => suppliers?.data.find((s) => s.id === id)?.companyName ?? "Loading…"

  async function handleCancel(id: number) {
    try {
      await cancelGrn.mutateAsync(id)
      toast.success("Goods receiving cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  const columns = useMemo<ColumnDef<GoodsReceiving>[]>(
    () => [
      { id: "grnNo", header: "GRN #", cell: ({ row }) => <span className="font-medium">{row.original.grnNo}</span> },
      { id: "poNo", header: "PO", cell: ({ row }) => `PO #${row.original.purchaseOrderId}` },
      { id: "supplier", header: "Supplier", cell: ({ row }) => supplierName(row.original.supplierId) },
      { id: "receivedDate", header: "Received date", cell: ({ row }) => row.original.receivedDate },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const grn = row.original
          return (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setViewingId(grn.id)}>
                View items
              </Button>
              {canManage && grn.status === "draft" && (
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancel</Button>} />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel GRN {grn.grnNo}?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Back</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => handleCancel(grn.id)}>
                        Cancel GRN
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
        <h1 className="text-lg font-semibold">Goods Receiving</h1>
        {canManage && <CreateGoodsReceivingDialog />}
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
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="received">received</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <PackageCheckIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No goods receiving records found</p>
          <p className="text-sm text-muted-foreground">Receive against an approved purchase order to get started.</p>
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
            <DialogTitle>Goods receiving items</DialogTitle>
          </DialogHeader>
          {viewingId && <GoodsReceivingItemsList grnId={viewingId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GoodsReceivingItemsList({ grnId }: { grnId: number }) {
  const { data: items, isLoading } = useGoodsReceivingItems(grnId)
  const { data: ingredients } = useIngredients({ limit: 200, trackableOnly: true })
  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? "Loading…"

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
          <TableHead>Batch</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{ingredientName(item.ingredientId)}</TableCell>
            <TableCell>{item.quantityReceived}</TableCell>
            <TableCell>{item.unitCost.toFixed(2)}</TableCell>
            <TableCell>{item.totalCost.toFixed(2)}</TableCell>
            <TableCell>{item.batchNo ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
