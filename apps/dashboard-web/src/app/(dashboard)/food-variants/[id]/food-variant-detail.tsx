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
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import {
  useDeleteFoodVariant,
  useFoodVariant,
  useFoodVariantOutlets,
  useRemoveFoodVariantOutlet,
  useUpdateFoodVariant,
  useUpsertFoodVariantOutlet,
} from "@/hooks/use-food-variants"
import { useOutlets } from "@/hooks/use-outlets"
import { useFood } from "@/hooks/use-foods"
import {
  useVariantList,
  type VariantListValue,
} from "@/hooks/use-variant-lists"
import { updateFoodVariantSchema, type UpdateFoodVariantInput } from "@/lib/validators/food-variants"
import { usePageTitle } from "@rms/ui/use-page-title"

export function FoodVariantDetail({ variantId }: { variantId: number }) {
  const router = useRouter()
  const { data: variant, isLoading } = useFoodVariant(variantId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: food } = useFood(variant?.foodId ?? 0)
  const updateVariant = useUpdateFoodVariant(variantId)
  const deleteVariant = useDeleteFoodVariant()

  const form = useForm<UpdateFoodVariantInput>({
    resolver: zodResolver(updateFoodVariantSchema),
    defaultValues: {
      name: "",
      variantId: null,
      subVariantId: null,
      price: 0,
      isDefault: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (variant) {
      form.reset({
        name: variant.name,
        variantId: variant.variantId ?? null,
        subVariantId: variant.subVariantId ?? null,
        price: variant.price,
        isDefault: variant.isDefault,
        isActive: variant.isActive,
      })
    }
  }, [variant, form])

  const { data: variantList } = useVariantList("variants")
  const { data: subVariantList } = useVariantList("sub-variants")
  const active = (rows?: VariantListValue[]) => (rows ?? []).filter((r) => r.isActive)

  async function onSubmit(values: UpdateFoodVariantInput) {
    try {
      await updateVariant.mutateAsync(values)
      toast.success("Food item updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update food item")
    }
  }

  async function handleDelete() {
    try {
      await deleteVariant.mutateAsync(variantId)
      toast.success("Food item deleted")
      router.push("/food-variants")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete food item")
    }
  }

  usePageTitle("Food Variant Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !variant) return <NotFoundCard resource="Food item" />
  if (!variant) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{variant.name}</h1>
          <p className="text-sm text-muted-foreground">{food?.name ?? "Loading…"}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete food item &quot;{variant.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the food item. This cannot be undone from the UI.</AlertDialogDescription>
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
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <p className="font-mono text-sm">{variant.sku ?? "-"}</p>
                <p className="text-xs text-muted-foreground">
                  Generated as food-variant-subvariant. Change a name, or set a
                  SKU code on the food or on a list value, to alter it.
                </p>
              </div>
              {(
                [
                  ["variantId", "Variant", active(variantList)],
                  ["subVariantId", "Sub-variant", active(subVariantList)],
                ] as const
              ).map(([fieldName, label, options]) => (
                <FormField
                  key={fieldName}
                  control={form.control}
                  name={fieldName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : "none"}
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? null : Number(value))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {options.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
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
                name="isDefault"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isDefault"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isDefault">Default variant for this food</Label>
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
              <Button type="submit" disabled={updateVariant.isPending}>
                {updateVariant.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <FoodVariantOutletOverrides variantId={variantId} />
    </div>
  )
}

function FoodVariantOutletOverrides({ variantId }: { variantId: number }) {
  const { data: overrides } = useFoodVariantOutlets(variantId)
  const { data: outlets } = useOutlets({ limit: 100 })
  const upsertOverride = useUpsertFoodVariantOutlet(variantId)
  const removeOverride = useRemoveFoodVariantOutlet(variantId)
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
          Absent from this list means the variant is available at that outlet at its own price.
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
