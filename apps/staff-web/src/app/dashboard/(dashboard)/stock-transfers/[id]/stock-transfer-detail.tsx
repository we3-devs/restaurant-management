"use client"

import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredients } from "@/hooks/use-ingredients"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import {
  useAddStockTransferItem,
  useApproveStockTransfer,
  useCancelStockTransfer,
  useRemoveStockTransferItem,
  useStockTransfer,
  useStockTransferItems,
} from "@/hooks/use-stock-transfers"
import { useWarehouses } from "@/hooks/use-warehouses"
import { usePageTitle } from "@rms/ui/use-page-title"

export function StockTransferDetail({ transferId }: { transferId: number }) {
  const { data: transfer, isLoading } = useStockTransfer(transferId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useStockTransferItems(transferId)
  const { data: ingredients } = useIngredients({ limit: 100, trackableOnly: true })
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data: sourceStocks } = useWarehouseIngredientStocks({
    warehouseId: transfer?.fromWarehouseId,
    limit: 100,
  })
  const addItem = useAddStockTransferItem(transferId)
  const removeItem = useRemoveStockTransferItem(transferId)
  const approve = useApproveStockTransfer(transferId)
  const cancel = useCancelStockTransfer(transferId)

  const [ingredientId, setIngredientId] = useState("")
  const [quantity, setQuantity] = useState("")

  async function handleAddItem() {
    if (!ingredientId || !quantity) return
    try {
      await addItem.mutateAsync({ ingredientId: Number(ingredientId), quantity: Number(quantity) })
      setIngredientId("")
      setQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync()
      toast.success("Transfer approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Transfer cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  usePageTitle("Stock Transfer Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !transfer) return <NotFoundCard resource="Stock transfer" />
  if (!transfer) return null

  const isDraft = transfer.status === "draft"
  const fromWarehouse = warehouses?.data.find((w) => w.id === transfer.fromWarehouseId)
  const toWarehouse = warehouses?.data.find((w) => w.id === transfer.toWarehouseId)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{transfer.transferNo}</h1>
          <p className="text-sm text-muted-foreground">
            {transfer.transferDate} · {fromWarehouse?.name ?? "Loading…"} → {toWarehouse?.name ?? "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={transfer.status} />
          {isDraft && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={cancel.isPending}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={approve.isPending}>
                {approve.isPending ? "Approving..." : "Approve"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>{isDraft ? "Unit cost (estimated)" : "Unit cost"}</TableHead>
                <TableHead>{isDraft ? "Total (estimated)" : "Total"}</TableHead>
                {isDraft && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{ingredients?.data.find((i) => i.id === item.ingredientId)?.name ?? "Loading…"}</TableCell>
                  <TableCell>{item.requestedQuantity}</TableCell>
                  <TableCell>
                    {item.unitCost || sourceStocks?.data.find((stock) => stock.ingredientId === item.ingredientId)?.averageCost || 0}
                  </TableCell>
                  <TableCell>
                    {item.totalCost || item.requestedQuantity * (sourceStocks?.data.find((stock) => stock.ingredientId === item.ingredientId)?.averageCost || 0)}
                  </TableCell>
                  {isDraft && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeItem.mutate(item.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {isDraft && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Ingredient</Label>
                <Select value={ingredientId} onValueChange={(value) => setIngredientId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients?.data.map((ingredient) => (
                      <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1.5">
                <Label>Quantity</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="20" />
              </div>
              <Button onClick={handleAddItem} disabled={addItem.isPending}>
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
