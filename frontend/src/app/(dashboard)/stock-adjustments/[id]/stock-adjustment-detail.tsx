"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredients } from "@/hooks/use-ingredients"
import {
  useAddStockAdjustmentItem,
  useApproveStockAdjustment,
  useCancelStockAdjustment,
  useRemoveStockAdjustmentItem,
  useStockAdjustment,
  useStockAdjustmentItems,
} from "@/hooks/use-stock-adjustments"

export function StockAdjustmentDetail({ adjustmentId }: { adjustmentId: number }) {
  const { data: adjustment, isLoading } = useStockAdjustment(adjustmentId)
  const { data: items } = useStockAdjustmentItems(adjustmentId)
  const { data: ingredients } = useIngredients({ limit: 100 })
  const addItem = useAddStockAdjustmentItem(adjustmentId)
  const removeItem = useRemoveStockAdjustmentItem(adjustmentId)
  const approve = useApproveStockAdjustment(adjustmentId)
  const cancel = useCancelStockAdjustment(adjustmentId)

  const [ingredientId, setIngredientId] = useState("")
  const [actualQuantity, setActualQuantity] = useState("")

  async function handleAddItem() {
    if (!ingredientId || !actualQuantity) return
    try {
      await addItem.mutateAsync({ ingredientId: Number(ingredientId), actualQuantity: Number(actualQuantity) })
      setIngredientId("")
      setActualQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync()
      toast.success("Adjustment approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Adjustment cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  if (isLoading || !adjustment) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  const isDraft = adjustment.status === "draft"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{adjustment.adjustmentNo}</h1>
          <p className="text-sm text-muted-foreground">{adjustment.adjustmentDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={adjustment.status === "approved" ? "secondary" : "outline"}>{adjustment.status}</Badge>
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
                <TableHead>System qty</TableHead>
                <TableHead>Actual qty</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Value</TableHead>
                {isDraft && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{ingredients?.data.find((i) => i.id === item.ingredientId)?.name ?? `#${item.ingredientId}`}</TableCell>
                  <TableCell>{item.systemQuantity}</TableCell>
                  <TableCell>{item.actualQuantity}</TableCell>
                  <TableCell>{item.differenceQuantity}</TableCell>
                  <TableCell>{item.differenceValue}</TableCell>
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
                <Label>Actual qty</Label>
                <Input value={actualQuantity} onChange={(e) => setActualQuantity(e.target.value)} placeholder="35" />
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
