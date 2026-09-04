"use client"

import { useEffect } from "react"
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
import { useDeleteIngredient, useIngredient, useUpdateIngredient } from "@/hooks/use-ingredients"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useWarehouses } from "@/hooks/use-warehouses"
import { updateIngredientSchema, type UpdateIngredientInput } from "@/lib/validators/ingredients"
import { usePageTitle } from "@rms/ui/use-page-title"

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
    defaultValues: { ingredientCategoryId: 0, name: "", code: "", isActive: true },
  })

  useEffect(() => {
    if (ingredient) {
      form.reset({
        ingredientCategoryId: ingredient.ingredientCategoryId,
        name: ingredient.name,
        code: ingredient.code,
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
        <h1 className="text-lg font-semibold">{ingredient.name}</h1>
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
