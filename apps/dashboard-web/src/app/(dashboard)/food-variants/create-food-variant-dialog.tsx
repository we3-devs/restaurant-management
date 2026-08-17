"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateFoodVariant } from "@/hooks/use-food-variants"
import {
  useVariantList,
  type VariantListValue,
} from "@/hooks/use-variant-lists"
import { useFoods } from "@/hooks/use-foods"
import { createFoodVariantSchema, type CreateFoodVariantInput } from "@/lib/validators/food-variants"

export function CreateFoodVariantDialog() {
  const [open, setOpen] = useState(false)
  const { data: foods } = useFoods({ limit: 100 })
  const createFoodVariant = useCreateFoodVariant()

  const form = useForm<CreateFoodVariantInput>({
    resolver: zodResolver(createFoodVariantSchema),
    defaultValues: { foodId: 0, variantId: null, subVariantId: null, name: "", price: 0, isDefault: false },
  })

  // The two global lists — the same values are offered for every food, which is
  // the point of them being global.
  const { data: variants } = useVariantList("variants")
  const { data: subVariants } = useVariantList("sub-variants")
  const active = (rows?: VariantListValue[]) => (rows ?? []).filter((r) => r.isActive)

  async function onSubmit(values: CreateFoodVariantInput) {
    try {
      await createFoodVariant.mutateAsync(values)
      toast.success(`Food item "${values.name}" created`)
      form.reset({ foodId: 0, variantId: null, subVariantId: null, name: "", price: 0, isDefault: false })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create food item")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create food item</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create food item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="foodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Food</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a food" />
                    </SelectTrigger>
                    <SelectContent>
                      {foods?.data.map((food) => (
                        <SelectItem key={food.id} value={String(food.id)}>
                          {food.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(
              [
                ["variantId", "Variant", active(variants), "e.g. Chicken"],
                ["subVariantId", "Sub-variant", active(subVariants), "e.g. Full"],
              ] as const
            ).map(([fieldName, label, options, hint]) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {label} <span className="text-muted-foreground">({hint})</span>
                    </FormLabel>
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
            <p className="text-xs text-muted-foreground">
              This food item is the pairing of the two above, and the price below
              belongs to that pairing alone. Both lists are shared across every
              food — add a value once and it is available everywhere.
            </p>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Large" {...field} />
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
            <DialogFooter>
              <Button type="submit" disabled={createFoodVariant.isPending}>
                {createFoodVariant.isPending ? "Creating..." : "Create food item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
