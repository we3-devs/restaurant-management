"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

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
import { useWarehouses } from "@/hooks/use-warehouses"

interface ReceivingRow {
  quantityReceived: string
  unitCost: string
  batchNo: string
  expiryDate: string
}

interface StandaloneLine {
  key: number
  ingredientId: string
  quantity: string
  unitCost: string
  batchNo: string
  expiryDate: string
}

let standaloneLineSeq = 0
function emptyStandaloneLine(): StandaloneLine {
  standaloneLineSeq += 1
  return { key: standaloneLineSeq, ingredientId: "", quantity: "", unitCost: "", batchNo: "", expiryDate: "" }
}

export function CreateGoodsReceivingDialog() {
  const [open, setOpen] = useState(false)
  const [poId, setPoId] = useState<string>("")
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [rows, setRows] = useState<Record<number, ReceivingRow>>({})
  const [standaloneSupplierId, setStandaloneSupplierId] = useState("")
  const [standaloneWarehouseId, setStandaloneWarehouseId] = useState("")
  const [standaloneLines, setStandaloneLines] = useState<StandaloneLine[]>([emptyStandaloneLine()])

  const { data: pos, isLoading: posLoading } = usePurchaseOrders({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data: po } = usePurchaseOrder(poId ? Number(poId) : 0)
  const { data: items } = usePurchaseOrderItems(poId ? Number(poId) : 0)
  const { data: ingredients } = useIngredients({ limit: 200 })
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const createGrn = useCreateGoodsReceiving()

  const receivablePos = (pos?.data ?? []).filter((p) => p.status === "approved" || p.status === "partially_received")
  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? "Loading…"

  function resetAll() {
    setPoId("")
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setNotes("")
    setRows({})
    setStandaloneSupplierId("")
    setStandaloneWarehouseId("")
    setStandaloneLines([emptyStandaloneLine()])
  }

  const emptyRow: ReceivingRow = { quantityReceived: "", unitCost: "", batchNo: "", expiryDate: "" }

  function updateRow(itemId: number, patch: Partial<ReceivingRow>) {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyRow), ...patch },
    }))
  }

  function updateStandaloneLine(key: number, patch: Partial<StandaloneLine>) {
    setStandaloneLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addStandaloneLine() {
    setStandaloneLines((prev) => [...prev, emptyStandaloneLine()])
  }

  function removeStandaloneLine(key: number) {
    setStandaloneLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev))
  }

  async function handleSubmit() {
    if (poId === "standalone") {
      const warehouse = warehouses?.data.find((w) => w.id === Number(standaloneWarehouseId))
      const standaloneItems = standaloneLines
        .filter((line) => line.ingredientId && Number(line.quantity) > 0)
        .map((line) => ({
          ingredientId: Number(line.ingredientId),
          quantityReceived: Number(line.quantity),
          unitCost: line.unitCost ? Number(line.unitCost) : undefined,
          batchNo: line.batchNo || undefined,
          expiryDate: line.expiryDate || undefined,
        }))
      if (!standaloneSupplierId || !warehouse || standaloneItems.length === 0) {
        toast.error("Select supplier, warehouse, and enter at least one item with a quantity")
        return
      }
      try {
        await createGrn.mutateAsync({
          supplierId: Number(standaloneSupplierId), outletId: warehouse.outletId, warehouseId: warehouse.id,
          receivedDate, notes: notes || undefined,
          items: standaloneItems,
        })
        toast.success("Goods receiving recorded")
        resetAll(); setOpen(false)
      } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to record goods receiving") }
      return
    }
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
                  <SelectItem value="standalone">Receive without purchase order</SelectItem>
                  {receivablePos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.poNo} · {suppliers?.data.find((s) => s.id === p.supplierId)?.companyName ?? "Loading…"}
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

          {poId === "standalone" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Supplier</Label><Select value={standaloneSupplierId} onValueChange={(v) => setStandaloneSupplierId(v ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{(suppliers?.data ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Warehouse</Label><Select value={standaloneWarehouseId} onValueChange={(v) => setStandaloneWarehouseId(v ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select warehouse" /></SelectTrigger><SelectContent>{(warehouses?.data ?? []).map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standaloneLines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        <Select value={line.ingredientId} onValueChange={(v) => updateStandaloneLine(line.key, { ingredientId: v ?? "" })}>
                          <SelectTrigger className="w-full min-w-40"><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>{(ingredients?.data ?? []).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="w-24" value={line.quantity} onChange={(e) => updateStandaloneLine(line.key, { quantity: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" className="w-24" placeholder="Buying price" value={line.unitCost} onChange={(e) => updateStandaloneLine(line.key, { unitCost: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="w-24" value={line.batchNo} onChange={(e) => updateStandaloneLine(line.key, { batchNo: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="date" className="w-36" value={line.expiryDate} onChange={(e) => updateStandaloneLine(line.key, { expiryDate: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={standaloneLines.length === 1}
                          onClick={() => removeStandaloneLine(line.key)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button type="button" variant="outline" size="sm" onClick={addStandaloneLine}>
                <Plus className="size-4" /> Add item
              </Button>
            </div>
          )}

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
          <Button onClick={handleSubmit} disabled={(!po && poId !== "standalone") || createGrn.isPending}>
            {createGrn.isPending ? "Saving..." : "Record receiving"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
