"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ImageUploadField } from "@/components/ui/image-upload-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFoodCategories } from "@/hooks/use-food-categories"
import { useIngredients } from "@/hooks/use-ingredients"
import { useCreateFood } from "@/hooks/use-foods"
import {
  FOOD_ITEM_TYPES,
  FOOD_TYPES,
  OUTLET_DEPARTMENT_TYPES,
  createFoodSchema,
  type CreateFoodInput,
} from "@/lib/validators/foods"

function slugifyFoodName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function CreateFoodDialog() {
  const [open, setOpen] = useState(false)
  const { data: categories, isLoading: categoriesLoading } = useFoodCategories({ limit: 100 })
  const { data: ingredients } = useIngredients({ limit: 500 })
  const createFood = useCreateFood()

  const form = useForm<CreateFoodInput>({
    resolver: zodResolver(createFoodSchema),
    defaultValues: {
      foodCategoryId: undefined,
      name: "",
      slug: "",
      skuSegment: "",
      imageUrl: "",
      itemType: "ready_made",
      inventoryIngredientId: null,
      basePrice: 0,
    },
  })

  async function onSubmit(values: CreateFoodInput) {
    try {
      await createFood.mutateAsync(values)
      toast.success(`Food "${values.name}" created`)
      form.reset({
        foodCategoryId: undefined,
        name: "",
        slug: "",
        skuSegment: "",
        imageUrl: "",
        itemType: "ready_made",
        inventoryIngredientId: null,
        basePrice: 0,
      })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create food")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create food</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create food</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="foodCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                  >
                    <SelectTrigger className="w-full" disabled={categoriesLoading}>
                      <SelectValue placeholder={categoriesLoading ? "Loading…" : "No category"} />
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
                  <FormControl
                    placeholder="Margherita Pizza"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event)
                      form.setValue("slug", slugifyFoodName(event.target.value))
                    }}
                  />
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
                  <FormControl placeholder="margherita-pizza" readOnly {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="skuSegment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU code (optional)</FormLabel>
                  <FormControl
                    placeholder="MOMO"
                    className="font-mono uppercase"
                    {...field}
                  />
                  <p className="text-xs text-muted-foreground">
                    This item&apos;s piece of the SKU. Variant codes are appended,
                    giving e.g. MOMO-CHI-FULL. Leave blank to keep SKUs manual.
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
                  <FormLabel>Photo (optional)</FormLabel>
                  <ImageUploadField
                    purpose="food"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    hint="Shown on the guest menu. Variants of this item share it."
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
              name="inventoryIngredientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direct inventory item (optional)</FormLabel>
                  <Select value={field.value ? String(field.value) : "none"} onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Not tracked directly" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not tracked directly</SelectItem>
                      {ingredients?.data.map((ingredient) => <SelectItem key={ingredient.id} value={String(ingredient.id)}>{ingredient.name} ({ingredient.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">For beverages, consumables, and other direct-sale items.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {false && <>
            <FormField
              control={form.control}
              name="departmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department (optional)</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
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
              name="foodType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Food type (optional)</FormLabel>
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
            </>}
            <DialogFooter>
              <Button type="submit" disabled={createFood.isPending}>
                {createFood.isPending ? "Creating..." : "Create food"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
