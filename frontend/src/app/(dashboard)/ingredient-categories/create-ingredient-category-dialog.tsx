"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateIngredientCategory, useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { createIngredientCategorySchema, type CreateIngredientCategoryInput } from "@/lib/validators/ingredient-categories"

export function CreateIngredientCategoryDialog() {
  const [open, setOpen] = useState(false)
  const { data: categories } = useIngredientCategories({ limit: 100 })
  const createCategory = useCreateIngredientCategory()

  const form = useForm<CreateIngredientCategoryInput>({
    resolver: zodResolver(createIngredientCategorySchema),
    defaultValues: { parentId: undefined, name: "", slug: "", code: "" },
  })

  async function onSubmit(values: CreateIngredientCategoryInput) {
    try {
      await createCategory.mutateAsync(values)
      toast.success(`Category "${values.name}" created`)
      form.reset({ parentId: undefined, name: "", slug: "", code: "" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create category</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create ingredient category</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No parent</SelectItem>
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
                  <FormControl placeholder="Vegetables" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl placeholder="vegetables" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Creating..." : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
