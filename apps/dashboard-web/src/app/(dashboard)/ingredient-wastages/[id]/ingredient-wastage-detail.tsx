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
  useAddIngredientWastageItem,
  useApproveIngredientWastage,
  useCancelIngredientWastage,
  useIngredientWastage,
  useIngredientWastageItems,
  useRemoveIngredientWastageItem,
} from "@/hooks/use-ingredient-wastages"

export function IngredientWastageDetail({ wastageId }: { wastageId: number }) {
  const { data: wastage, isLoading } = useIngredientWastage(wastageId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useIngredientWastageItems(wastageId)
  const { data: ingredients } = useIngredients({ limit: 100 })
  const addItem = useAddIngredientWastageItem(wastageId)
  const removeItem = useRemoveIngredientWastageItem(wastageId)
  const approve = useApproveIngredientWastage(wastageId)
  const cancel = useCancelIngredientWastage(wastageId)

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
      toast.success("Wastage approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Wastage cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !wastage) return <NotFoundCard resource="Ingredient wastage" />
  if (!wastage) return null

  const isDraft = wastage.status === "draft"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{wastage.wastageNo}</h1>
          <p className="text-sm text-muted-foreground">{wastage.wastageDate} · {wastage.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={wastage.status} />
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
                  <TableCell>{ingredients?.data.find((i) => i.id === item.ingredientId)?.name ?? `#${item.ingredientId}`}</TableCell>
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
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="5" />
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
