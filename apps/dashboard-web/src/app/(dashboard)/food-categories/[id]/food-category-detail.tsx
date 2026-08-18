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
  useDeleteFoodCategory,
  useFoodCategories,
  useFoodCategory,
  useUpdateFoodCategory,
} from "@/hooks/use-food-categories"
import { updateFoodCategorySchema, type UpdateFoodCategoryInput } from "@/lib/validators/food-categories"

export function FoodCategoryDetail({ categoryId }: { categoryId: number }) {
  const router = useRouter()
  const { data: category, isLoading } = useFoodCategory(categoryId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: categories } = useFoodCategories({ limit: 100 })
  const updateCategory = useUpdateFoodCategory(categoryId)
  const deleteCategory = useDeleteFoodCategory()

  const form = useForm<UpdateFoodCategoryInput>({
    resolver: zodResolver(updateFoodCategorySchema),
    defaultValues: { name: "", parentId: undefined, description: "", isActive: true },
  })

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        parentId: category.parentId ?? undefined,
        description: category.description ?? "",
        isActive: category.isActive,
      })
    }
  }, [category, form])

  async function onSubmit(values: UpdateFoodCategoryInput) {
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
      router.push("/food-categories")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={4} />
  if (!isLoading && !category) return <NotFoundCard resource="Food category" />
  if (!category) return null

  const otherCategories = (categories?.data ?? []).filter((c) => c.id !== categoryId)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{category.name}</h1>
          <p className="text-sm text-muted-foreground">{category.slug}</p>
        </div>
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
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent category</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No parent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No parent</SelectItem>
                        {otherCategories.map((c) => (
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
