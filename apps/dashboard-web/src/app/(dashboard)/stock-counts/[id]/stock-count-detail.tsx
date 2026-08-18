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
  useAddStockCountItem,
  useCancelStockCount,
  useCompleteStockCount,
  usePostStockCountAdjustments,
  useRemoveStockCountItem,
  useStockCount,
  useStockCountItems,
} from "@/hooks/use-stock-counts"

export function StockCountDetail({ countId }: { countId: number }) {
  const { data: count, isLoading } = useStockCount(countId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useStockCountItems(countId)
  const { data: ingredients } = useIngredients({ limit: 100 })
  const addItem = useAddStockCountItem(countId)
  const removeItem = useRemoveStockCountItem(countId)
  const complete = useCompleteStockCount(countId)
  const postAdjustments = usePostStockCountAdjustments(countId)
  const cancel = useCancelStockCount(countId)

  const [ingredientId, setIngredientId] = useState("")
  const [countedQuantity, setCountedQuantity] = useState("")

  async function handleAddItem() {
    if (!ingredientId || !countedQuantity) return
    try {
      await addItem.mutateAsync({ ingredientId: Number(ingredientId), countedQuantity: Number(countedQuantity) })
      setIngredientId("")
      setCountedQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  async function handleComplete() {
    try {
      await complete.mutateAsync()
      toast.success("Count completed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete count")
    }
  }

  async function handlePostAdjustments() {
    try {
      await postAdjustments.mutateAsync()
      toast.success("Adjustments posted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post adjustments")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Count cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !count) return <NotFoundCard resource="Stock count" />
  if (!count) return null

  const isDraft = count.status === "draft"
  const isCompleted = count.status === "completed"
  const canCancel = isDraft || isCompleted

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{count.countNo}</h1>
          <p className="text-sm text-muted-foreground">{count.countDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={count.status} />
          {canCancel && (
            <Button variant="outline" onClick={handleCancel} disabled={cancel.isPending}>
              Cancel
            </Button>
          )}
          {isDraft && (
            <Button onClick={handleComplete} disabled={complete.isPending}>
              {complete.isPending ? "Completing..." : "Complete count"}
            </Button>
          )}
          {isCompleted && (
            <Button onClick={handlePostAdjustments} disabled={postAdjustments.isPending}>
              {postAdjustments.isPending ? "Posting..." : "Post adjustments"}
            </Button>
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
                <TableHead>Counted qty</TableHead>
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
                  <TableCell>{item.countedQuantity}</TableCell>
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
                <Label>Counted qty</Label>
                <Input value={countedQuantity} onChange={(e) => setCountedQuantity(e.target.value)} placeholder="65" />
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
