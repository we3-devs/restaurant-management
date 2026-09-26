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
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { useDeleteIngredient, useIngredient, useIngredients, useUpdateIngredient } from "@/hooks/use-ingredients"

import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import { updateIngredientSchema, type UpdateIngredientInput } from "@/lib/validators/ingredients"
import { usePageTitle } from "@rms/ui/use-page-title"
import {
  useAddIngredientVariant,
  useAddIngredientVariantPortion,
  useIngredientVariantPortions,
  useIngredientVariants,
  useIngredientVariantsForIngredient,
  useReceiveVariantsStock,
  useRemoveIngredientVariant,
  useRemoveIngredientVariantPortion,
  type IngredientVariant,
} from "@/hooks/use-ingredient-variants"
import { useUnits } from "@/hooks/use-units"

export function IngredientDetail({ ingredientId }: { ingredientId: number }) {
  const router = useRouter()
  const { data: ingredient, isLoading } = useIngredient(ingredientId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useIngredientCategories({ limit: 100 })
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data: stocks } = useWarehouseIngredientStocks({ ingredientId, limit: 100 })
  const updateIngredient = useUpdateIngredient(ingredientId)
  const deleteIngredient = useDeleteIngredient()

  const form = useForm<UpdateIngredientInput>({
    resolver: zodResolver(updateIngredientSchema),
    defaultValues: { ingredientCategoryId: 0, name: "", code: "", sellingPrice: 0, isActive: true },
  })

  useEffect(() => {
    if (ingredient) {
      form.reset({
        ingredientCategoryId: ingredient.ingredientCategoryId,
        name: ingredient.name,
        code: ingredient.code,
        sellingPrice: ingredient.sellingPrice,
        isActive: ingredient.isActive,
      })
    }
  }, [ingredient, form])



  async function onSubmit(values: UpdateIngredientInput) {
    try {
      await updateIngredient.mutateAsync(values)
      toast.success("Ingredient updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update ingredient")
    }
  }

  async function handleDelete() {
    try {
      await deleteIngredient.mutateAsync(ingredientId)
      toast.success("Ingredient deleted")
      router.push("/dashboard/inventory/ingredients")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete ingredient")
    }
  }

  usePageTitle("Ingredient Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !ingredient) return <NotFoundCard resource="Ingredient" />
  if (!ingredient) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{ingredient.name}</h1>
          <p className="text-sm text-muted-foreground">
            Outlet: {ingredient.outlet?.name ?? "—"}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete ingredient &quot;{ingredient.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the ingredient. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="ingredientCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.data.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
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
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling price</FormLabel>
                    <FormControl type="number" min="0" step="0.01" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
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
              <Button type="submit" disabled={updateIngredient.isPending}>
                {updateIngredient.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current stock by warehouse</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Average cost</TableHead>
                <TableHead>Stock value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks?.data.map((stock) => (
                <TableRow key={stock.id}>
                  <TableCell>
                    {warehouses?.data.find((w) => w.id === stock.warehouseId)?.name ?? "Loading…"}
                  </TableCell>
                  <TableCell>{stock.quantity}</TableCell>
                  <TableCell>{stock.averageCost}</TableCell>
                  <TableCell>{stock.stockValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <VariantOfCard ingredientId={ingredientId} />
      <VariantsCard parentIngredientId={ingredientId} />
      <ReceiveStockCard parentIngredientId={ingredientId} />
    </div>
  )
}

/** If this ingredient is itself a size variant of some other base item, link back to it. */
function VariantOfCard({ ingredientId }: { ingredientId: number }) {
  const { data: variantOf } = useIngredientVariantsForIngredient(ingredientId)
  if (!variantOf?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variant of</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {variantOf.map((link) => (
          <p key={link.id} className="text-sm">
            <a href={`/dashboard/inventory/ingredients/${link.parentIngredientId}`} className="underline">
              {link.parentName}
            </a>{" "}
            <span className="text-muted-foreground">— {link.label}</span>
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Size variants of this base item (e.g. 250ml, 500ml Beer), each backed by
 * its own stock-tracked Ingredient. Replaces the old standalone Inventory
 * Kit page — variants are managed right here instead.
 */
function VariantsCard({ parentIngredientId }: { parentIngredientId: number }) {
  const { data: variants } = useIngredientVariants(parentIngredientId)
  const { data: ingredients } = useIngredients({ limit: 200, trackableOnly: true })
  const { data: units } = useUnits({ limit: 100 })
  const addVariant = useAddIngredientVariant(parentIngredientId)
  const removeVariant = useRemoveIngredientVariant(parentIngredientId)

  const [ingredientId, setIngredientId] = useState("")
  const [label, setLabel] = useState("")
  const [unitId, setUnitId] = useState("")
  const [unitsPerPackage, setUnitsPerPackage] = useState("")
  const [packageLabel, setPackageLabel] = useState("Carton")
  const [expandedVariantId, setExpandedVariantId] = useState<number | null>(null)

  const otherIngredients = ingredients?.data.filter((ingredient) => ingredient.id !== parentIngredientId)

  async function handleAdd() {
    if (!ingredientId || !label || !unitId) return
    try {
      await addVariant.mutateAsync({
        ingredientId: Number(ingredientId),
        label,
        unitId: Number(unitId),
        unitsPerPackage: unitsPerPackage ? Number(unitsPerPackage) : undefined,
        packageLabel: unitsPerPackage ? packageLabel : undefined,
      })
      toast.success("Variant added")
      setIngredientId("")
      setLabel("")
      setUnitId("")
      setUnitsPerPackage("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add variant")
    }
  }

  async function handleRemove(variantId: number) {
    try {
      await removeVariant.mutateAsync(variantId)
      toast.success("Variant removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove variant")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Ingredient</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Package</TableHead>
              <TableHead className="text-right">Stock qty</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants?.length ? (
              variants.map((variant) => {
                const variantIngredient = ingredients?.data.find((i) => i.id === variant.ingredientId)
                const unit = units?.data.find((u) => u.id === variant.unitId)
                const isExpanded = expandedVariantId === variant.id
                return (
                  <>
                    <TableRow key={variant.id}>
                      <TableCell>{variant.label}</TableCell>
                      <TableCell>{variantIngredient?.name ?? variant.ingredientId}</TableCell>
                      <TableCell>{unit?.shortName ?? variant.unitId}</TableCell>
                      <TableCell>
                        {variant.unitsPerPackage
                          ? `${variant.unitsPerPackage} / ${variant.packageLabel ?? "package"}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <VariantStock ingredientId={variant.ingredientId} />
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedVariantId(isExpanded ? null : variant.id)}
                        >
                          {isExpanded ? "Hide portions" : "Portions"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(variant.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${variant.id}-portions`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <VariantPortions
                            parentIngredientId={parentIngredientId}
                            variantId={variant.id}
                            variantUnitId={variant.unitId}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  No variants yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>Ingredient</Label>
            <Select value={ingredientId} onValueChange={(value) => setIngredientId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an ingredient" />
              </SelectTrigger>
              <SelectContent>
                {otherIngredients?.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                    {ingredient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="250ml" />
          </div>
          <div className="w-28 space-y-1.5">
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
          <div className="w-24 space-y-1.5">
            <Label>Per package</Label>
            <Input
              type="number"
              min="1"
              value={unitsPerPackage}
              onChange={(e) => setUnitsPerPackage(e.target.value)}
              placeholder="4"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Package name</Label>
            <Input value={packageLabel} onChange={(e) => setPackageLabel(e.target.value)} placeholder="Carton" />
          </div>
          <Button onClick={handleAdd} disabled={addVariant.isPending}>
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Per package&quot; is optional — set it (e.g. 4 bottles per carton) to receive stock for this
          variant in cartons below, instead of bottle-by-bottle.
        </p>
      </CardContent>
    </Card>
  )
}

function VariantStock({ ingredientId }: { ingredientId: number }) {
  const { data: stocks } = useWarehouseIngredientStocks({ ingredientId, limit: 100 })
  const total = stocks?.data.reduce((sum, stock) => sum + stock.quantity, 0) ?? 0
  return <span>{total}</span>
}

function VariantPortions({
  parentIngredientId,
  variantId,
  variantUnitId,
}: {
  parentIngredientId: number
  variantId: number
  variantUnitId: number
}) {
  const { data: portions } = useIngredientVariantPortions(parentIngredientId, variantId)
  const { data: units } = useUnits({ limit: 100 })
  const addPortion = useAddIngredientVariantPortion(parentIngredientId, variantId)
  const removePortion = useRemoveIngredientVariantPortion(parentIngredientId, variantId)

  const [name, setName] = useState("")
  const [unitId, setUnitId] = useState(String(variantUnitId))
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
        e.g. a 0.25 quantity deducts a quarter of one unit of this variant per sale, once attached to a menu
        item&apos;s recipe.
      </p>
    </div>
  )
}

/**
 * Goods receipt across several variants of this item at once — e.g. 1 carton
 * (4x 250ml) plus 3 cartons (4x 500ml each) entered and saved together. Each
 * line updates its own variant's stock separately via the regular Stock-In
 * ledger, in one saved batch.
 */
function ReceiveStockCard({ parentIngredientId }: { parentIngredientId: number }) {
  const { data: variants } = useIngredientVariants(parentIngredientId)
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const receiveStock = useReceiveVariantsStock(parentIngredientId)

  const [warehouseId, setWarehouseId] = useState("")
  const [stockInDate, setStockInDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState("")
  const [packagesByVariant, setPackagesByVariant] = useState<Record<number, string>>({})

  if (!variants?.length) return null

  async function handleSave() {
    const lines = Object.entries(packagesByVariant)
      .map(([variantId, packages]) => ({ variantId: Number(variantId), packages: Number(packages) }))
      .filter((line) => line.packages > 0)

    if (!warehouseId || lines.length === 0) {
      toast.error("Select a warehouse and enter a quantity for at least one variant")
      return
    }

    try {
      await receiveStock.mutateAsync({ warehouseId: Number(warehouseId), stockInDate, remarks: remarks || undefined, lines })
      toast.success("Stock received")
      setPackagesByVariant({})
      setRemarks("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to receive stock")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive stock</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={(value) => setWarehouseId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.data.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={stockInDate} onChange={(e) => setStockInDate(e.target.value)} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>= Total units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant: IngredientVariant) => {
              const raw = packagesByVariant[variant.id] ?? ""
              const packages = Number(raw)
              const total = variant.unitsPerPackage && packages > 0 ? packages * variant.unitsPerPackage : packages
              return (
                <TableRow key={variant.id}>
                  <TableCell>{variant.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={raw}
                      onChange={(e) =>
                        setPackagesByVariant((prev) => ({ ...prev, [variant.id]: e.target.value }))
                      }
                      placeholder={variant.unitsPerPackage ? variant.packageLabel ?? "Packages" : "Quantity"}
                      className="w-28"
                    />
                    {variant.unitsPerPackage && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {variant.packageLabel ?? "package"}(s) of {variant.unitsPerPackage}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{raw ? total : "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="space-y-1.5">
          <Label>Remarks (optional)</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. supplier invoice #" />
        </div>

        <Button onClick={handleSave} disabled={receiveStock.isPending}>
          {receiveStock.isPending ? "Saving..." : "Save receipt"}
        </Button>
      </CardContent>
    </Card>
  )
}
