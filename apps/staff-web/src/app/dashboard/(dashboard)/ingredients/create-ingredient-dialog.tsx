"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateIngredient } from "@/hooks/use-ingredients"
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { useUnits } from "@/hooks/use-units"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { createIngredientSchema, type CreateIngredientInput } from "@/lib/validators/ingredients"

export function CreateIngredientDialog() {
  const [open, setOpen] = useState(false)
  const { outletId: activeOutletId } = useActiveOutlet()
  const { data: categories, isLoading: categoriesLoading } = useIngredientCategories({ limit: 100 })
  const { data: units, isLoading: unitsLoading } = useUnits({ limit: 100 })
  const createIngredient = useCreateIngredient()

  const defaultValues = { outletId: activeOutletId ?? 0, ingredientCategoryId: 0, name: "", slug: "", code: "", sellingPrice: 0, baseUnitId: 0 }

  const form = useForm<CreateIngredientInput>({
    resolver: zodResolver(createIngredientSchema),
    defaultValues,
  })

  async function onSubmit(values: CreateIngredientInput) {
    try {
      await createIngredient.mutateAsync({ ...values, outletId: activeOutletId ?? values.outletId })
      toast.success(`Ingredient "${values.name}" created`)
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create ingredient")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create ingredient</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create ingredient</DialogTitle>
        </DialogHeader>
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
                    <SelectTrigger className="w-full" disabled={categoriesLoading}>
                      <SelectValue placeholder={categoriesLoading ? "Loading…" : "Select a category"} />
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
                  <FormControl placeholder="Chicken Breast" {...field} />
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
                  <FormControl placeholder="chicken-breast" {...field} />
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
                  <FormControl placeholder="ING-0001" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base unit</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full" disabled={unitsLoading}>
                      <SelectValue placeholder={unitsLoading ? "Loading…" : "Select a unit"} />
                    </SelectTrigger>
                    <SelectContent>
                      {units?.data.map((unit) => (
                        <SelectItem key={unit.id} value={String(unit.id)}>
                          {unit.name} ({unit.shortName})
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
              name="sellingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling price</FormLabel>
                  <FormControl type="number" min="0" step="0.01" {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                  <FormMessage />
                </FormItem>
              )}
            />
            {activeOutletId === null && (
              <p className="text-sm text-muted-foreground">
                Select a specific outlet from the outlet picker to create an ingredient.
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={createIngredient.isPending || activeOutletId === null}>
                {createIngredient.isPending ? "Creating..." : "Create ingredient"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
