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
import {
  useAddStockOutItem,
  useApproveStockOut,
  useCancelStockOut,
  useRemoveStockOutItem,
  useStockOut,
  useStockOutItems,
} from "@/hooks/use-stock-outs"

export function StockOutDetail({ stockOutId }: { stockOutId: number }) {
  const { data: stockOut, isLoading } = useStockOut(stockOutId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useStockOutItems(stockOutId)
  const { data: ingredients } = useIngredients({ limit: 100, trackableOnly: true })
  const addItem = useAddStockOutItem(stockOutId)
  const removeItem = useRemoveStockOutItem(stockOutId)
  const approve = useApproveStockOut(stockOutId)
  const cancel = useCancelStockOut(stockOutId)

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
      toast.success("Stock-out approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Stock-out cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !stockOut) return <NotFoundCard resource="Stock-out" />
  if (!stockOut) return null

  const isDraft = stockOut.status === "draft"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{stockOut.stockOutNo}</h1>
          <p className="text-sm text-muted-foreground">{stockOut.stockOutDate} · {stockOut.purpose}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={stockOut.status} />
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
                <TableHead>Unit cost</TableHead>
                <TableHead>Total</TableHead>
                {isDraft && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{ingredients?.data.find((i) => i.id === item.ingredientId)?.name ?? "Loading…"}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.unitCost}</TableCell>
                  <TableCell>{item.totalCost}</TableCell>
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
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="30" />
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
