"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredients } from "@/hooks/use-ingredients"
import {
  useAddKitItem,
  useAddKitPortion,
  useDeleteInventoryKit,
  useInventoryKit,
  useKitItems,
  useKitPortions,
  useRemoveKitItem,
  useRemoveKitPortion,
  useUpdateInventoryKit,
} from "@/hooks/use-inventory-kits"
import { useUnits } from "@/hooks/use-units"
import { updateInventoryKitSchema, type UpdateInventoryKitInput } from "@/lib/validators/inventory-kits"
import { usePageTitle } from "@rms/ui/use-page-title"
import { KitItemStock } from "./kit-item-stock"

export function InventoryKitDetail({ kitId }: { kitId: number }) {
  const router = useRouter()
  const { data: kit, isLoading } = useInventoryKit(kitId)
  const showSkeleton = useDelayedLoading(isLoading)
  const updateKit = useUpdateInventoryKit(kitId)
  const deleteKit = useDeleteInventoryKit()

  const form = useForm<UpdateInventoryKitInput>({
    resolver: zodResolver(updateInventoryKitSchema),
    defaultValues: { name: "", description: "", isActive: true },
  })

  useEffect(() => {
    if (kit) {
      form.reset({ name: kit.name, description: kit.description ?? "", isActive: kit.isActive })
    }
  }, [kit, form])

  async function onSubmit(values: UpdateInventoryKitInput) {
    try {
      await updateKit.mutateAsync(values)
      toast.success("Kit updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update kit")
    }
  }

  async function handleDelete() {
    try {
      await deleteKit.mutateAsync(kitId)
      toast.success("Kit deleted")
      router.push("/dashboard/inventory-kits")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete kit")
    }
  }

  usePageTitle("Inventory Kit Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !kit) return <NotFoundCard resource="Inventory kit" />
  if (!kit) return null

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{kit.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete kit &quot;{kit.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the kit. This cannot be undone from the UI.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                )}
              />
              <Button type="submit" disabled={updateKit.isPending}>
                {updateKit.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <KitItemsCard kitId={kitId} />
    </div>
  )
}

function KitItemsCard({ kitId }: { kitId: number }) {
  const { data: items } = useKitItems(kitId)
  const { data: ingredients } = useIngredients({ limit: 200, trackableOnly: true })
  const { data: units } = useUnits({ limit: 100 })
  const addItem = useAddKitItem(kitId)
  const removeItem = useRemoveKitItem(kitId)

  const [ingredientId, setIngredientId] = useState("")
  const [label, setLabel] = useState("")
  const [unitId, setUnitId] = useState("")
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)

  async function handleAdd() {
    if (!ingredientId || !label || !unitId) return
    try {
      await addItem.mutateAsync({ ingredientId: Number(ingredientId), label, unitId: Number(unitId) })
      toast.success("Variance added")
      setIngredientId("")
      setLabel("")
      setUnitId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add variance")
    }
  }

  async function handleRemove(itemId: number) {
    try {
      await removeItem.mutateAsync(itemId)
      toast.success("Variance removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove variance")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Ingredient</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Stock qty</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => {
              const ingredient = ingredients?.data.find((i) => i.id === item.ingredientId)
              const unit = units?.data.find((u) => u.id === item.unitId)
              const isExpanded = expandedItemId === item.id
              return (
                <>
                  <TableRow key={item.id}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{ingredient?.name ?? item.ingredientId}</TableCell>
                    <TableCell>{unit?.shortName ?? item.unitId}</TableCell>
                    <TableCell className="text-right">
                      <KitItemStock ingredientId={item.ingredientId} />
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? "Hide portions" : "Portions"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${item.id}-portions`}>
                      <TableCell colSpan={5} className="bg-muted/30">
                        <KitPortions kitId={kitId} itemId={item.id} itemUnitId={item.unitId} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>

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
          <div className="w-32 space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="250ml" />
          </div>
          <div className="w-32 space-y-1.5">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={(value) => setUnitId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {units?.data.map((unit) => (
                  <SelectItem key={unit.id} value={String(unit.id)}>
                    {unit.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={addItem.isPending}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KitPortions({ kitId, itemId, itemUnitId }: { kitId: number; itemId: number; itemUnitId: number }) {
  const { data: portions } = useKitPortions(kitId, itemId)
  const { data: units } = useUnits({ limit: 100 })
  const addPortion = useAddKitPortion(kitId, itemId)
  const removePortion = useRemoveKitPortion(kitId, itemId)

  const [name, setName] = useState("")
  const [unitId, setUnitId] = useState(String(itemUnitId))
  const [quantity, setQuantity] = useState("")

  async function handleAdd() {
    if (!name || !unitId || !quantity) return
    try {
      await addPortion.mutateAsync({ name, unitId: Number(unitId), quantity: Number(quantity) })
      toast.success("Portion added")
      setName("")
      setQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add portion")
    }
  }

  async function handleRemove(portionId: number) {
    try {
      await removePortion.mutateAsync(portionId)
      toast.success("Portion removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove portion")
    }
  }

  return (
    <div className="space-y-3 py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {portions?.map((portion) => {
            const unit = units?.data.find((u) => u.id === portion.unitId)
            return (
              <TableRow key={portion.id}>
                <TableCell>{portion.name}</TableCell>
                <TableCell className="tabular-nums">{portion.quantity}</TableCell>
                <TableCell>{unit?.shortName ?? portion.unitId}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(portion.id)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarter Peg" />
        </div>
        <div className="w-28 space-y-1.5">
          <Label>Quantity</Label>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.25" />
        </div>
        <div className="w-32 space-y-1.5">
          <Label>Unit</Label>
          <Select value={unitId} onValueChange={(value) => setUnitId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {units?.data.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={addPortion.isPending}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        e.g. a 0.25 quantity deducts a quarter of one unit of this variance per sale, once attached to a menu
        item&apos;s recipe.
      </p>
    </div>
  )
}
