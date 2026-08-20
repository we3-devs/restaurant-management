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
import { useCreatePurchaseReturn } from "@/hooks/use-purchase-returns"
import { REFUND_TYPES, type CreatePurchaseReturnInput } from "@/lib/validators/purchase-returns"
import { useSuppliers } from "@/hooks/use-suppliers"

const RECEIVED_STATUSES = ["partially_received", "received", "completed"]

export function CreatePurchaseReturnDialog() {
  const [open, setOpen] = useState(false)
  const [poId, setPoId] = useState<string>("")
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [refundType, setRefundType] = useState<CreatePurchaseReturnInput["refundType"]>("refund")
  const [quantities, setQuantities] = useState<Record<number, string>>({})

  const { data: pos, isLoading: posLoading } = usePurchaseOrders({ limit: 100 })
  const { data: suppliers } = useSuppliers({ limit: 100 })
  const { data: po } = usePurchaseOrder(poId ? Number(poId) : 0)
  const { data: items } = usePurchaseOrderItems(poId ? Number(poId) : 0)
  const { data: ingredients } = useIngredients({ limit: 200 })
  const createReturn = useCreatePurchaseReturn()

  const returnablePos = (pos?.data ?? []).filter((p) => RECEIVED_STATUSES.includes(p.status))
  const receivedItems = (items ?? []).filter((item) => item.receivedQuantity > 0)
  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? "Loading…"

  function resetAll() {
    setPoId("")
    setReturnDate(new Date().toISOString().slice(0, 10))
    setReason("")
    setRefundType("refund")
    setQuantities({})
  }

  async function handleSubmit() {
    if (!po) return
    const returnItems = receivedItems
      .map((item) => {
        const qty = Number(quantities[item.id] ?? "")
        if (!qty || qty <= 0) return null
        return { purchaseOrderItemId: item.id, ingredientId: item.ingredientId, quantity: qty, unitCost: item.unitCost }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (returnItems.length === 0) {
      toast.error("Enter a return quantity for at least one item")
      return
    }

    try {
      await createReturn.mutateAsync({
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        outletId: po.outletId,
        warehouseId: po.warehouseId,
        returnDate,
        reason: reason || undefined,
        refundType,
        items: returnItems,
      })
      toast.success("Purchase return created")
      resetAll()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create purchase return")
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
      <DialogTrigger render={<Button>Create return</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create purchase return</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Purchase order</Label>
              <Select value={poId} onValueChange={(v) => { setPoId(v ?? ""); setQuantities({}) }}>
                <SelectTrigger className="w-full" disabled={posLoading}>
                  <SelectValue placeholder={posLoading ? "Loading…" : "Select a purchase order"} />
                </SelectTrigger>
                <SelectContent>
                  {returnablePos.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.poNo} · {suppliers?.data.find((s) => s.id === p.supplierId)?.companyName ?? "Loading…"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Return date</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Refund type</Label>
              <Select value={refundType} onValueChange={(v) => setRefundType(v as CreatePurchaseReturnInput["refundType"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged goods" />
            </div>
          </div>

          {po && receivedItems.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Return qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{ingredientName(item.ingredientId)}</TableCell>
                    <TableCell>{item.receivedQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        value={quantities[item.id] ?? ""}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!po || createReturn.isPending}>
            {createReturn.isPending ? "Saving..." : "Create return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
