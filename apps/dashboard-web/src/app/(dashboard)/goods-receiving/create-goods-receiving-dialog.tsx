"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredients } from "@/hooks/use-ingredients"
import { usePurchaseOrder, usePurchaseOrderItems, usePurchaseOrders } from "@/hooks/use-purchase-orders"
import { useCreateGoodsReceiving } from "@/hooks/use-goods-receiving"
import { useSuppliers } from "@/hooks/use-suppliers"

interface ReceivingRow {
  quantityReceived: string
  unitCost: string
  batchNo: string
  expiryDate: string
}

export function CreateGoodsReceivingDialog() {
  const [open, setOpen] = useState(false)
  const [poId, setPoId] = useState<string>("")
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [rows, setRows] = useState<Record<number, ReceivingRow>>({})

  const { data: pos, isLoading: posLoading } = usePurchaseOrders({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data: po } = usePurchaseOrder(poId ? Number(poId) : 0)
  const { data: items } = usePurchaseOrderItems(poId ? Number(poId) : 0)
  const { data: ingredients } = useIngredients({ limit: 200 })
  const createGrn = useCreateGoodsReceiving()

  const receivablePos = (pos?.data ?? []).filter((p) => p.status === "approved" || p.status === "partially_received")
  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? `#${id}`

  function resetAll() {
    setPoId("")
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setNotes("")
    setRows({})
  }

  const emptyRow: ReceivingRow = { quantityReceived: "", unitCost: "", batchNo: "", expiryDate: "" }

  function updateRow(itemId: number, patch: Partial<ReceivingRow>) {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyRow), ...patch },
    }))
  }

  async function handleSubmit() {
    if (!po) return
    const receivingItems = (items ?? [])
      .map((item) => {
        const row = rows[item.id]
        const qty = row ? Number(row.quantityReceived) : 0
        if (!qty || qty <= 0) return null
        return {
          purchaseOrderItemId: item.id,
          ingredientId: item.ingredientId,
          quantityReceived: qty,
          unitCost: row.unitCost ? Number(row.unitCost) : undefined,
          batchNo: row.batchNo || undefined,
          expiryDate: row.expiryDate || undefined,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (receivingItems.length === 0) {
      toast.error("Enter a received quantity for at least one item")
      return
    }

    try {
      await createGrn.mutateAsync({
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        outletId: po.outletId,
        warehouseId: po.warehouseId,
        receivedDate,
        notes: notes || undefined,
        items: receivingItems,
      })
      toast.success("Goods receiving recorded")
      resetAll()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record goods receiving")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetAll()
      }}
    >
      <DialogTrigger render={<Button>Receive goods</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive goods against a purchase order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Purchase order</Label>
              <Select value={poId} onValueChange={(v) => { setPoId(v ?? ""); setRows({}) }}>
                <SelectTrigger className="w-full" disabled={posLoading}>
                  <SelectValue placeholder={posLoading ? "Loading…" : "Select a PO awaiting delivery"} />
                </SelectTrigger>
                <SelectContent>
                  {receivablePos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.poNo} · {suppliers?.data.find((s) => s.id === p.supplierId)?.companyName ?? `Supplier #${p.supplierId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Received date</Label>
              <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            </div>
          </div>

          {po && items && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Receive qty</TableHead>
                  <TableHead>Unit cost</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .filter((item) => item.remainingQuantity > 0)
                  .map((item) => {
                    const row = rows[item.id]
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{ingredientName(item.ingredientId)}</TableCell>
                        <TableCell>{item.remainingQuantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            value={row?.quantityReceived ?? ""}
                            onChange={(e) => updateRow(item.id, { quantityReceived: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            placeholder={String(item.unitCost)}
                            value={row?.unitCost ?? ""}
                            onChange={(e) => updateRow(item.id, { unitCost: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-24"
                            value={row?.batchNo ?? ""}
                            onChange={(e) => updateRow(item.id, { batchNo: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="w-36"
                            value={row?.expiryDate ?? ""}
                            onChange={(e) => updateRow(item.id, { expiryDate: e.target.value })}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!po || createGrn.isPending}>
            {createGrn.isPending ? "Saving..." : "Record receiving"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
