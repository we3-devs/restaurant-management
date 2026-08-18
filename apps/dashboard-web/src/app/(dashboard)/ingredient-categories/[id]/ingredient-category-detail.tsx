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
import {
  useDeleteIngredientCategory,
  useIngredientCategories,
  useIngredientCategory,
  useUpdateIngredientCategory,
} from "@/hooks/use-ingredient-categories"
import { updateIngredientCategorySchema, type UpdateIngredientCategoryInput } from "@/lib/validators/ingredient-categories"

export function IngredientCategoryDetail({ categoryId }: { categoryId: number }) {
  const router = useRouter()
  const { data: category, isLoading } = useIngredientCategory(categoryId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useIngredientCategories({ limit: 100 })
  const updateCategory = useUpdateIngredientCategory(categoryId)
  const deleteCategory = useDeleteIngredientCategory()

  const form = useForm<UpdateIngredientCategoryInput>({
    resolver: zodResolver(updateIngredientCategorySchema),
    defaultValues: { parentId: undefined, name: "", code: "", isActive: true },
  })

  useEffect(() => {
    if (category) {
      form.reset({
        parentId: category.parentId ?? undefined,
        name: category.name,
        code: category.code ?? "",
        isActive: category.isActive,
      })
    }
  }, [category, form])

  async function onSubmit(values: UpdateIngredientCategoryInput) {
    try {
      await updateCategory.mutateAsync(values)
      toast.success("Category updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category")
    }
  }

  async function handleDelete() {
    try {
      await deleteCategory.mutateAsync(categoryId)
      toast.success("Category deleted")
      router.push("/ingredient-categories")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !category) return <NotFoundCard resource="Ingredient category" />
  if (!category) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{category.name}</h1>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete category &quot;{category.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the category. This cannot be undone from the UI.</AlertDialogDescription>
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
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No parent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No parent</SelectItem>
                        {categories?.data
                          .filter((c) => c.id !== categoryId)
                          .map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
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
              <Button type="submit" disabled={updateCategory.isPending}>
                {updateCategory.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
