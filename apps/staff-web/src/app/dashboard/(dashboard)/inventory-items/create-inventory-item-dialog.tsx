"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIngredients } from "@/hooks/use-ingredients"
import { useCreateInventoryItem } from "@/hooks/use-inventory-stock"
import { useUnits } from "@/hooks/use-units"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useActiveOutlet } from "@/lib/api/outlet/active-outlet-context"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { createInventoryItemSchema, type CreateInventoryItemInput } from "@/lib/validators/stock-ins"

const DEFAULTS: CreateInventoryItemInput = { ingredientId: 0, warehouseId: 0, quantity: 0, unitCost: 0 }

/**
 * Creating an ingredient only produces reference data — this is what puts it
 * in a warehouse, which is what makes it an inventory item. Deliberately
 * separate from "Create ingredient": the two answer different questions
 * ("what is this thing?" vs "how much of it do we have, and where?").
 */
export function CreateInventoryItemDialog({ warehouseId }: { warehouseId?: number }) {
  const [open, setOpen] = useState(false)
  const { outletId } = useActiveOutlet()
  // The opening balance posts as a stock-in document, so this needs the
  // stock-in permission rather than the inventory one the page is gated on
  // — without it the dialog would only ever hand back a 403.
  const { permissions } = useCurrentUser()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100, outletId: outletId ?? undefined })
  const { data: ingredients, isLoading: ingredientsLoading } = useIngredients({ limit: 500, outletId: outletId ?? undefined })
  const { data: units } = useUnits({ limit: 500 })
  const createInventoryItem = useCreateInventoryItem()

  const form = useForm<CreateInventoryItemInput>({
    resolver: zodResolver(createInventoryItemSchema),
    // Preselect whatever warehouse the page is filtered to, since that's
    // almost always the one being stocked.
    defaultValues: { ...DEFAULTS, warehouseId: warehouseId ?? 0 },
  })

  const selectedIngredientId = form.watch("ingredientId")
  const unitLabel = useMemo(() => {
    const ingredient = ingredients?.data.find((candidate) => candidate.id === selectedIngredientId)
    if (!ingredient) return null
    const unit = units?.data.find((candidate) => candidate.id === ingredient.baseUnitId)
    return unit?.shortName ?? unit?.name ?? null
  }, [ingredients, selectedIngredientId, units])

  async function onSubmit(values: CreateInventoryItemInput) {
    const ingredient = ingredients?.data.find((candidate) => candidate.id === values.ingredientId)
    try {
      await createInventoryItem.mutateAsync({
        ...values,
        remarks: `Opening stock for ${ingredient?.name ?? `ingredient #${values.ingredientId}`}`,
      })
      toast.success(`"${ingredient?.name ?? "Item"}" added to inventory`)
      form.reset({ ...DEFAULTS, warehouseId: values.warehouseId })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add inventory item")
    }
  }

  if (!permissions.includes("stock-ins.manage")) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add inventory item</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add inventory item</DialogTitle>
          <DialogDescription>
            Stocks an existing ingredient into a warehouse. This posts an opening-stock entry, so the quantity shows up in the ledger and in stock reports.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ingredientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredient</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full" disabled={ingredientsLoading}>
                      <SelectValue placeholder={ingredientsLoading ? "Loading…" : "Select an ingredient"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients?.data.map((ingredient) => (
                        <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                          {ingredient.name} ({ingredient.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full" disabled={warehousesLoading}>
                      <SelectValue placeholder={warehousesLoading ? "Loading…" : "Select a warehouse"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.data.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening quantity{unitLabel ? ` (${unitLabel})` : ""}</FormLabel>
                    <FormControl
                      type="number"
                      step="0.0001"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit cost</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createInventoryItem.isPending}>
                {createInventoryItem.isPending ? "Adding…" : "Add to inventory"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
