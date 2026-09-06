"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useUpdateIngredient, type Ingredient } from "@/hooks/use-ingredients"
import { updateIngredientSchema, type UpdateIngredientInput } from "@/lib/validators/ingredients"

export function EditInventoryItemDialog({ ingredient }: { ingredient: Ingredient }) {
  const [open, setOpen] = useState(false)
  const updateIngredient = useUpdateIngredient(ingredient.id)
  const form = useForm<UpdateIngredientInput>({
    resolver: zodResolver(updateIngredientSchema),
    defaultValues: {
      ingredientCategoryId: ingredient.ingredientCategoryId,
      name: ingredient.name,
      code: ingredient.code,
      sellingPrice: ingredient.sellingPrice,
      isActive: ingredient.isActive,
    },
  })

  useEffect(() => {
    form.reset({
      ingredientCategoryId: ingredient.ingredientCategoryId,
      name: ingredient.name,
      code: ingredient.code,
      sellingPrice: ingredient.sellingPrice,
      isActive: ingredient.isActive,
    })
  }, [ingredient, form])

  async function onSubmit(values: UpdateIngredientInput) {
    try {
      await updateIngredient.mutateAsync(values)
      toast.success(`Inventory item "${values.name}" updated`)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update inventory item")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit inventory item</DialogTitle>
        </DialogHeader>
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
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item code</FormLabel>
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
            <DialogFooter>
              <Button type="submit" disabled={updateIngredient.isPending}>
                {updateIngredient.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
