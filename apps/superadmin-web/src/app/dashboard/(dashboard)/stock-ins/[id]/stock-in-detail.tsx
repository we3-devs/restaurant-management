"use client"

import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredients } from "@/hooks/use-ingredients"
import { useUnitConversions, useUnits } from "@/hooks/use-units"
import { usePageTitle } from "@rms/ui/use-page-title"
import {
  useAddStockInItem,
  useApproveStockIn,
  useCancelStockIn,
  useRemoveStockInItem,
  useStockIn,
  useStockInItems,
} from "@/hooks/use-stock-ins"

export function StockInDetail({ stockInId }: { stockInId: number }) {
  const { data: stockIn, isLoading } = useStockIn(stockInId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: items } = useStockInItems(stockInId)
  const { data: ingredients } = useIngredients({ limit: 100, trackableOnly: true })
  const { data: units } = useUnits({ limit: 100 })
  const addItem = useAddStockInItem(stockInId)
  const removeItem = useRemoveStockInItem(stockInId)
  const approve = useApproveStockIn(stockInId)
  const cancel = useCancelStockIn(stockInId)

  const [ingredientId, setIngredientId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [unitId, setUnitId] = useState("")

  const selectedIngredient = ingredients?.data.find((i) => i.id === Number(ingredientId))
  const baseUnitId = selectedIngredient?.baseUnitId ?? 0
  const { data: unitConversions } = useUnitConversions(baseUnitId)
  const baseUnit = units?.data.find((u) => u.id === baseUnitId)
  const linkedUnits = [
    ...(baseUnit ? [baseUnit] : []),
    ...(unitConversions
      ?.map((c) => units?.data.find((u) => u.id === c.toUnitId))
      .filter((u): u is NonNullable<typeof u> => Boolean(u)) ?? []),
  ]

  function handleIngredientChange(value: string | null) {
    setIngredientId(value ?? "")
    setUnitId("")
  }

  async function handleAddItem() {
    if (!ingredientId || !quantity) return
    try {
      await addItem.mutateAsync({
        ingredientId: Number(ingredientId),
        quantity: Number(quantity),
        unitId: unitId ? Number(unitId) : undefined,
        unitCost: Number(unitCost || 0),
      })
      setIngredientId("")
      setQuantity("")
      setUnitCost("")
      setUnitId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add item")
    }
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync()
      toast.success("Stock-in approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync()
      toast.success("Stock-in cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  usePageTitle("Stock In Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !stockIn) return <NotFoundCard resource="Stock-in" />
  if (!stockIn) return null

  const isDraft = stockIn.status === "draft"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{stockIn.stockInNo}</h1>
          <p className="text-sm text-muted-foreground">{stockIn.stockInDate} · {stockIn.source}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={stockIn.status} />
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

      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Ingredient</TableHead>
                <TableHead className="w-28">Quantity</TableHead>
                <TableHead className="w-28">Unit</TableHead>
                <TableHead className="w-28">Unit cost</TableHead>
                <TableHead>Total</TableHead>
                {isDraft && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => {
                const ingredient = ingredients?.data.find((i) => i.id === item.ingredientId)
                const unit = units?.data.find((u) => u.id === ingredient?.baseUnitId)
                return (
                <TableRow key={item.id}>
                  <TableCell>{ingredient?.name ?? "Loading…"}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{unit?.shortName ?? "—"}</TableCell>
                  <TableCell>{item.unitCost}</TableCell>
                  <TableCell>{item.totalCost || item.quantity * item.unitCost}</TableCell>
                  {isDraft && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeItem.mutate(item.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
                )
              })}
              {isDraft && (
                <TableRow>
                  <TableCell>
                    <Select value={ingredientId} onValueChange={handleIngredientChange}>
                      <SelectTrigger className="w-64">
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
                  </TableCell>
                  <TableCell>
                    <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={unitId || (baseUnitId ? String(baseUnitId) : "")}
                      onValueChange={(value) => setUnitId(value ?? "")}
                      disabled={!ingredientId}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {linkedUnits.map((unit) => (
                          <SelectItem key={unit.id} value={String(unit.id)}>
                            {unit.shortName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="50" />
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Button onClick={handleAddItem} disabled={addItem.isPending}>
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
