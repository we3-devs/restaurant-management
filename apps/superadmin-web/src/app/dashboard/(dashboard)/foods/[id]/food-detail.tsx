"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ImageUploadField } from "@/components/ui/image-upload-field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import { useFoodCategories } from "@/hooks/use-food-categories"
import {
  useAddFoodRecipe,
  useAssignFoodAddonGroup,
  useDeleteFood,
  useFood,
  useFoodAddonGroups,
  useFoodOutlets,
  useFoodRecipes,
  useRemoveFoodOutlet,
  useRemoveFoodRecipe,
  useUnassignFoodAddonGroup,
  useUpdateFood,
  useUpsertFoodOutlet,
} from "@/hooks/use-foods"
import { useIngredients } from "@/hooks/use-ingredients"
import { useOutlets } from "@/hooks/use-outlets"
import { useUnits } from "@/hooks/use-units"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import {
  FOOD_ITEM_TYPES,
  FOOD_TYPES,
  OUTLET_DEPARTMENT_TYPES,
  updateFoodSchema,
  type UpdateFoodInput,
} from "@/lib/validators/foods"

export function FoodDetail({ foodId }: { foodId: number }) {
  const router = useRouter()
  const { data: food, isLoading } = useFood(foodId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useFoodCategories({ limit: 100 })
  const { data: inventoryIngredients } = useIngredients({ limit: 500 })
  const updateFood = useUpdateFood(foodId)
  const deleteFood = useDeleteFood()

  const form = useForm<UpdateFoodInput>({
    resolver: zodResolver(updateFoodSchema),
    defaultValues: {
      foodCategoryId: undefined,
      name: "",
      sku: "",
      skuSegment: "",
      shortDescription: "",
      description: "",
      imageUrl: "",
      itemType: "ready_made",
      inventoryIngredientId: null,
      departmentType: undefined,
      basePrice: 0,
      isTaxable: true,
      isDiscountable: true,
      isFeatured: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (food) {
      form.reset({
        foodCategoryId: food.foodCategoryId ?? undefined,
        name: food.name,
        sku: food.sku ?? "",
        skuSegment: food.skuSegment ?? "",
        shortDescription: food.shortDescription ?? "",
        description: food.description ?? "",
        imageUrl: food.imageUrl ?? "",
        foodType: (food.foodType as UpdateFoodInput["foodType"]) ?? undefined,
        itemType: food.itemType as UpdateFoodInput["itemType"],
        inventoryIngredientId: food.inventoryIngredientId,
        departmentType: (food.departmentType as UpdateFoodInput["departmentType"]) ?? undefined,
        basePrice: food.basePrice,
        isTaxable: food.isTaxable,
        isDiscountable: food.isDiscountable,
        isFeatured: food.isFeatured,
        isActive: food.isActive,
      })
    }
  }, [food, form])

  async function onSubmit(values: UpdateFoodInput) {
    try {
      await updateFood.mutateAsync(values)
      toast.success("Food updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update food")
    }
  }

  async function handleDelete() {
    try {
      await deleteFood.mutateAsync(foodId)
      toast.success("Food deleted")
      router.push("/dashboard/foods")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete food")
    }
  }

  usePageTitle("Food Details")

  if (showSkeleton) return <DetailPageSkeleton fields={8} />
  if (!isLoading && !food) return <NotFoundCard resource="Food" />
  if (!food) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{food.name}</h1>
          <p className="text-sm text-muted-foreground">{food.slug}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete food &quot;{food.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the food. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="foodCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
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
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skuSegment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU code</FormLabel>
                    <FormControl
                      placeholder="MOMO"
                      className="font-mono uppercase"
                      {...field}
                    />
                    <p className="text-xs text-muted-foreground">
                      Setting this rewrites the SKU above, and every variant&apos;s,
                      as e.g. MOMO-CHI-FULL. Leave blank to keep SKUs manual.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo</FormLabel>
                    <ImageUploadField
                      purpose="food"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      hint="Shown on the guest menu. Variants share this image."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base price</FormLabel>
                    <FormControl
                      type="number"
                      step="0.01"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOOD_ITEM_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type === "ready_made" ? "Ready-made" : "Kitchen"}
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
                name="departmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None — ready-made" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None — ready-made</SelectItem>
                        {OUTLET_DEPARTMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="inventoryIngredientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direct inventory item (optional)</FormLabel>
                    <Select value={field.value ? String(field.value) : "none"} onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Not tracked directly" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not tracked directly</SelectItem>
                        {inventoryIngredients?.data.map((ingredient) => <SelectItem key={ingredient.id} value={String(ingredient.id)}>{ingredient.name} ({ingredient.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Use for beverages, consumables, or other direct-sale items. Kitchen foods should use Recipe below.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="foodType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food type</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Not specified" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {FOOD_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="isFeatured"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isFeatured"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isFeatured">Featured</Label>
                  </div>
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
              <Button type="submit" disabled={updateFood.isPending}>
                {updateFood.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <FoodOutletOverrides foodId={foodId} />
      <FoodAddonGroups foodId={foodId} hasAddons={food.hasAddons} />
      <FoodRecipes foodId={foodId} />
      <FoodInventory inventoryIngredientId={food.inventoryIngredientId} />
    </div>
  )
}

function FoodInventory({ inventoryIngredientId }: { inventoryIngredientId: number | null }) {
  const { outletId } = useActiveOutlet()
  const { data: ingredients } = useIngredients({ limit: 500, outletId: outletId ?? undefined })
  const { data: units } = useUnits({ limit: 500 })
  const { data: warehouses } = useWarehouses({ limit: 100, outletId: outletId ?? undefined })
  const [warehouseId, setWarehouseId] = useState("")
  const selectedWarehouseId = warehouseId ? Number(warehouseId) : warehouses?.data.find((w) => w.isDefault)?.id
  const { data: stocks, isLoading } = useWarehouseIngredientStocks({ warehouseId: selectedWarehouseId })
  const rows = useMemo(() => {
    const stockByIngredient = new Map((stocks?.data ?? []).map((stock) => [stock.ingredientId, stock]))
    const ingredientById = new Map((ingredients?.data ?? []).map((ingredient) => [ingredient.id, ingredient]))
    const unitById = new Map((units?.data ?? []).map((unit) => [unit.id, unit]))
    if (inventoryIngredientId) {
      const stock = stockByIngredient.get(inventoryIngredientId)
      const ingredient = ingredientById.get(inventoryIngredientId)
      return [{ recipe: { id: inventoryIngredientId, ingredientId: inventoryIngredientId, quantity: 1, wastageQuantity: 0, isActive: true, unitId: ingredient?.baseUnitId ?? 0 }, ingredient, unit: ingredient ? unitById.get(ingredient.baseUnitId) : undefined, available: stock ? Math.max(0, stock.quantity - stock.reservedQuantity) : 0 }]
    }
    return []
  }, [inventoryIngredientId, stocks, ingredients, units])
  const unavailable = rows.filter((row) => row.available < row.recipe.quantity + row.recipe.wastageQuantity)

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2">Inventory availability <Badge variant={unavailable.length ? "destructive" : "secondary"}>{unavailable.length ? "unavailable" : "available"}</Badge></CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Only direct-sale items linked to an inventory ingredient are stock-controlled. Kitchen foods are not tracked here.</p>
      <Select value={warehouseId || (selectedWarehouseId ? String(selectedWarehouseId) : "")} onValueChange={(value) => setWarehouseId(value ?? "")}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
        <SelectContent>{warehouses?.data.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}{warehouse.isDefault ? " (default)" : ""}</SelectItem>)}</SelectContent>
      </Select>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading stock…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Kitchen food or no direct inventory item linked. This item is not stock-controlled.</p> : <div className="space-y-2">
        {rows.map(({ recipe, ingredient, unit, available }) => { const required = recipe.quantity + recipe.wastageQuantity; const inStock = available >= required; return <div key={recipe.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{ingredient?.name ?? `Ingredient #${recipe.ingredientId}`} <span className="text-muted-foreground">· needs {required} {unit?.shortName ?? unit?.name ?? "units"}</span></span><Badge variant={inStock ? "secondary" : "destructive"}>{inStock ? `${available} available` : "out of stock"}</Badge></div> })}
      </div>}
    </CardContent>
  </Card>
}

function FoodRecipes({ foodId }: { foodId: number }) {
  const { data: recipes } = useFoodRecipes(foodId)
  const { data: ingredients } = useIngredients({ limit: 100 })
  const { data: units } = useUnits({ limit: 100 })
  const addRecipe = useAddFoodRecipe(foodId)
  const removeRecipe = useRemoveFoodRecipe(foodId)

  const [ingredientId, setIngredientId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")

  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? "Loading…"
  const unitName = (id: number) => units?.data.find((u) => u.id === id)?.shortName ?? "Loading…"

  async function handleAdd() {
    if (!ingredientId || !unitId || !quantity) return
    try {
      await addRecipe.mutateAsync({
        ingredientId: Number(ingredientId),
        unitId: Number(unitId),
        quantity: Number(quantity),
        wastageQuantity: 0,
      })
      toast.success("Recipe row added")
      setIngredientId("")
      setUnitId("")
      setQuantity("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add recipe row")
    }
  }

  async function handleRemove(recipeId: number) {
    try {
      await removeRecipe.mutateAsync(recipeId)
      toast.success("Recipe row removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove recipe row")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Only used when &quot;Recipe enabled&quot; is checked above — each row reserves that much of the
          ingredient (in its own unit) per unit of this food ordered.
        </p>
        <div className="space-y-2">
          {(recipes ?? []).length === 0 && <p className="text-sm text-muted-foreground">No recipe rows.</p>}
          {(recipes ?? []).map((recipe) => (
            <div key={recipe.id} className="flex items-center gap-2">
              <Badge variant="secondary">{ingredientName(recipe.ingredientId)}</Badge>
              <span className="text-sm">
                {recipe.quantity} {unitName(recipe.unitId)}
              </span>
              {recipe.foodVariantId && <Badge variant="outline">variant #{recipe.foodVariantId}</Badge>}
              <Button variant="ghost" size="sm" onClick={() => handleRemove(recipe.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Ingredient</label>
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
            <label className="text-sm font-medium">Unit</label>
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
            <label className="text-sm font-medium">Quantity</label>
            <input
              type="number"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="200"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            />
          </div>
          <Button onClick={handleAdd} disabled={!ingredientId || !unitId || !quantity || addRecipe.isPending}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FoodOutletOverrides({ foodId }: { foodId: number }) {
  const { data: overrides } = useFoodOutlets(foodId)
  const { data: outlets } = useOutlets({ limit: 100 })
  const upsertOverride = useUpsertFoodOutlet(foodId)
  const removeOverride = useRemoveFoodOutlet(foodId)
  const [selectedOutletId, setSelectedOutletId] = useState<string>("")
  const [price, setPrice] = useState<string>("")
  const [isAvailable, setIsAvailable] = useState(true)

  const outletName = (outletId: number) => outlets?.data.find((o) => o.id === outletId)?.name ?? "Loading…"

  async function handleAdd() {
    if (!selectedOutletId) return
    try {
      await upsertOverride.mutateAsync({
        outletId: Number(selectedOutletId),
        price: price ? Number(price) : undefined,
        isAvailable,
      })
      toast.success("Outlet override saved")
      setSelectedOutletId("")
      setPrice("")
      setIsAvailable(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save override")
    }
  }

  async function handleRemove(outletId: number) {
    try {
      await removeOverride.mutateAsync(outletId)
      toast.success("Override removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove override")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outlet overrides</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Absent from this list means the food is available at that outlet at its base price.
        </p>
        <div className="space-y-2">
          {(overrides ?? []).length === 0 && <p className="text-sm text-muted-foreground">No overrides.</p>}
          {(overrides ?? []).map((override) => (
            <div key={override.id} className="flex items-center gap-2">
              <Badge variant="secondary">{outletName(override.outletId)}</Badge>
              {override.price !== null && <span className="text-sm">${override.price}</span>}
              {!override.isAvailable && <Badge variant="destructive">unavailable</Badge>}
              <Button variant="ghost" size="sm" onClick={() => handleRemove(override.outletId)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Outlet</label>
            <Select value={selectedOutletId} onValueChange={(value) => setSelectedOutletId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets?.data.map((outlet) => (
                  <SelectItem key={outlet.id} value={String(outlet.id)}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1.5">
            <label className="text-sm font-medium">Price</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="base"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 pb-2">
            <Checkbox id="override-available" checked={isAvailable} onCheckedChange={(c) => setIsAvailable(c === true)} />
            <Label htmlFor="override-available">Available</Label>
          </div>
          <Button onClick={handleAdd} disabled={!selectedOutletId || upsertOverride.isPending}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FoodAddonGroups({ foodId, hasAddons }: { foodId: number; hasAddons: boolean }) {
  const { data: links } = useFoodAddonGroups(foodId)
  const { data: addonGroups } = useAddonGroups({ limit: 100 })
  const assignGroup = useAssignFoodAddonGroup(foodId)
  const unassignGroup = useUnassignFoodAddonGroup(foodId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")

  const groupName = (addonGroupId: number) =>
    addonGroups?.data.find((g) => g.id === addonGroupId)?.name ?? "Loading…"

  async function handleAssign() {
    if (!selectedGroupId) return
    try {
      await assignGroup.mutateAsync(Number(selectedGroupId))
      toast.success("Addon group assigned")
      setSelectedGroupId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign addon group")
    }
  }

  async function handleUnassign(addonGroupId: number) {
    try {
      await unassignGroup.mutateAsync(addonGroupId)
      toast.success("Addon group unassigned")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unassign addon group")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Addon groups
          {hasAddons && <Badge variant="secondary">has addons</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(links ?? []).length === 0 && <p className="text-sm text-muted-foreground">No addon groups assigned.</p>}
          {(links ?? []).map((link) => (
            <div key={link.id} className="flex items-center gap-1.5">
              <Badge variant="secondary">{groupName(link.addonGroupId)}</Badge>
              <Button variant="ghost" size="sm" onClick={() => handleUnassign(link.addonGroupId)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Assign an addon group</label>
            <Select value={selectedGroupId} onValueChange={(value) => setSelectedGroupId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an addon group" />
              </SelectTrigger>
              <SelectContent>
                {addonGroups?.data.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={!selectedGroupId || assignGroup.isPending}>
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
