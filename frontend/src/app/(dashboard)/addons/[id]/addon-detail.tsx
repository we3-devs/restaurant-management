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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddonGroups } from "@/hooks/use-addon-groups"
import {
  useAddAddonRecipe,
  useAddon,
  useAddonRecipes,
  useDeleteAddon,
  useRemoveAddonRecipe,
  useUpdateAddon,
} from "@/hooks/use-addons"
import { useIngredients } from "@/hooks/use-ingredients"
import { useUnits } from "@/hooks/use-units"
import { updateAddonSchema, type UpdateAddonInput } from "@/lib/validators/addons"

export function AddonDetail({ addonId }: { addonId: number }) {
  const router = useRouter()
  const { data: addon, isLoading } = useAddon(addonId)
  const { data: addonGroups } = useAddonGroups({ limit: 100 })
  const updateAddon = useUpdateAddon(addonId)
  const deleteAddon = useDeleteAddon()

  const form = useForm<UpdateAddonInput>({
    resolver: zodResolver(updateAddonSchema),
    defaultValues: {
      addonGroupId: undefined,
      name: "",
      price: 0,
      isRecipeEnabled: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (addon) {
      form.reset({
        addonGroupId: addon.addonGroupId ?? undefined,
        name: addon.name,
        price: addon.price,
        isRecipeEnabled: addon.isRecipeEnabled,
        isActive: addon.isActive,
      })
    }
  }, [addon, form])

  async function onSubmit(values: UpdateAddonInput) {
    try {
      await updateAddon.mutateAsync(values)
      toast.success("Addon updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update addon")
    }
  }

  async function handleDelete() {
    try {
      await deleteAddon.mutateAsync(addonId)
      toast.success("Addon deleted")
      router.push("/addons")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete addon")
    }
  }

  if (isLoading || !addon) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{addon.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete addon &quot;{addon.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the addon. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="addonGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Addon group</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No group</SelectItem>
                        {addonGroups?.data.map((group) => (
                          <SelectItem key={group.id} value={String(group.id)}>
                            {group.name}
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
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
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
                name="isRecipeEnabled"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isRecipeEnabled"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isRecipeEnabled">
                      Recipe enabled (reserves ingredient stock when ordered)
                    </Label>
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
              <Button type="submit" disabled={updateAddon.isPending}>
                {updateAddon.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AddonRecipes addonId={addonId} />
    </div>
  )
}

function AddonRecipes({ addonId }: { addonId: number }) {
  const { data: recipes } = useAddonRecipes(addonId)
  const { data: ingredients } = useIngredients({ limit: 100 })
  const { data: units } = useUnits({ limit: 100 })
  const addRecipe = useAddAddonRecipe(addonId)
  const removeRecipe = useRemoveAddonRecipe(addonId)

  const [ingredientId, setIngredientId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")

  const ingredientName = (id: number) => ingredients?.data.find((i) => i.id === id)?.name ?? `#${id}`
  const unitName = (id: number) => units?.data.find((u) => u.id === id)?.shortName ?? `#${id}`

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
          ingredient (in its own unit) per unit of this addon ordered.
        </p>
        <div className="space-y-2">
          {(recipes ?? []).length === 0 && <p className="text-sm text-muted-foreground">No recipe rows.</p>}
          {(recipes ?? []).map((recipe) => (
            <div key={recipe.id} className="flex items-center gap-2">
              <Badge variant="secondary">{ingredientName(recipe.ingredientId)}</Badge>
              <span className="text-sm">
                {recipe.quantity} {unitName(recipe.unitId)}
              </span>
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
              placeholder="50"
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
