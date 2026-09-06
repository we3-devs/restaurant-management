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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { useDeleteIngredient, useIngredient, useMoveIngredientToOutlet, useUpdateIngredient } from "@/hooks/use-ingredients"
import { useSuperadminOutlets, useSuperadminTenants } from "@/hooks/use-outlets"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import { updateIngredientSchema, type UpdateIngredientInput } from "@/lib/validators/ingredients"
import { usePageTitle } from "@rms/ui/use-page-title"

export function IngredientDetail({ ingredientId }: { ingredientId: number }) {
  const router = useRouter()
  const { isSuperadmin } = useCurrentUser()
  const { data: ingredient, isLoading } = useIngredient(ingredientId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useIngredientCategories({ limit: 100 })
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const { data: stocks } = useWarehouseIngredientStocks({ ingredientId, limit: 100 })
  const updateIngredient = useUpdateIngredient(ingredientId)
  const deleteIngredient = useDeleteIngredient()
  const moveIngredient = useMoveIngredientToOutlet(ingredientId)
  const { data: allOutlets } = useSuperadminOutlets({ enabled: isSuperadmin })
  const { data: allTenants } = useSuperadminTenants({ enabled: isSuperadmin })
  const [targetTenantId, setTargetTenantId] = useState("")
  const [targetOutletId, setTargetOutletId] = useState("")

  const form = useForm<UpdateIngredientInput>({
    resolver: zodResolver(updateIngredientSchema),
    defaultValues: { ingredientCategoryId: 0, name: "", code: "", sellingPrice: 0, isActive: true },
  })

  useEffect(() => {
    if (ingredient) {
      setTargetTenantId(String(ingredient.outlet?.tenant?.id ?? ""))
      setTargetOutletId(String(ingredient.outletId))
      form.reset({
        ingredientCategoryId: ingredient.ingredientCategoryId,
        name: ingredient.name,
        code: ingredient.code,
        sellingPrice: ingredient.sellingPrice,
        isActive: ingredient.isActive,
      })
    }
  }, [ingredient, form])

  const tenants = useMemo(() => {
    return (allTenants ?? []).filter((tenant) => tenant.isActive).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTenants])

  const tenantOutlets = useMemo(
    () => (allOutlets ?? []).filter((outlet) => String(outlet.tenant?.id ?? "") === targetTenantId),
    [allOutlets, targetTenantId],
  )

  function handleTenantChange(value: string | null) {
    const nextTenantId = value ?? ""
    setTargetTenantId(nextTenantId)
    setTargetOutletId(String((allOutlets ?? []).find((outlet) => String(outlet.tenant?.id) === nextTenantId)?.id ?? ""))
  }

  async function handleMove() {
    const outletId = Number(targetOutletId)
    if (!outletId || outletId === ingredient?.outletId) return
    try {
      await moveIngredient.mutateAsync(outletId)
      toast.success("Ingredient moved to the selected outlet")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move ingredient")
    }
  }

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
      router.push("/dashboard/ingredients")
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
            Tenant: {ingredient.outlet?.tenant?.name ?? "—"} · Outlet: {ingredient.outlet?.name ?? "—"}
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

      {isSuperadmin && (
        <Card>
          <CardHeader><CardTitle>Repair ownership</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Move this ingredient to the correct hotel/outlet. Its history and ID will be preserved.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select
                items={tenants.map((tenant) => ({ value: String(tenant.id), label: tenant.name }))}
                value={targetTenantId}
                onValueChange={handleTenantChange}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select destination tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => <SelectItem key={tenant.id} value={String(tenant.id)}>{tenant.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                items={tenantOutlets.map((outlet) => ({ value: String(outlet.id), label: outlet.name }))}
                value={targetOutletId}
                onValueChange={(value) => setTargetOutletId(value ?? "")}
              >
                <SelectTrigger className="w-full" disabled={!targetTenantId || tenantOutlets.length === 0}><SelectValue placeholder={targetTenantId && tenantOutlets.length === 0 ? "No outlets in this tenant" : "Select destination outlet"} /></SelectTrigger>
                <SelectContent>
                  {tenantOutlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={String(outlet.id)}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetTenantId && tenantOutlets.length === 0 && <p className="text-xs text-muted-foreground sm:col-span-2">Create or assign an outlet to this tenant in Tenant Management before moving this ingredient.</p>}
              <Button type="button" className="sm:col-span-2 sm:justify-self-end" onClick={() => void handleMove()} disabled={moveIngredient.isPending || !targetOutletId || Number(targetOutletId) === ingredient.outletId}>
                {moveIngredient.isPending ? "Moving..." : "Move ingredient"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}
