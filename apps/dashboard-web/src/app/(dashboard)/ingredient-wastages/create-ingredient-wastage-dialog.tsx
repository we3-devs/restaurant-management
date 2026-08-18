"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateIngredientWastage } from "@/hooks/use-ingredient-wastages"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createIngredientWastageSchema, type CreateIngredientWastageInput } from "@/lib/validators/ingredient-wastages"

const reasons = ["expired", "damaged", "spoiled", "over_preparation", "staff_error", "other"] as const

export function CreateIngredientWastageDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createWastage = useCreateIngredientWastage()

  const form = useForm<CreateIngredientWastageInput>({
    resolver: zodResolver(createIngredientWastageSchema),
    defaultValues: { warehouseId: 0, wastageDate: new Date().toISOString().slice(0, 10), reason: "other" },
  })

  async function onSubmit(values: CreateIngredientWastageInput) {
    try {
      const wastage = await createWastage.mutateAsync(values)
      toast.success(`Wastage "${wastage.wastageNo}" created`)
      setOpen(false)
      router.push(`/ingredient-wastages/${wastage.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create wastage")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create wastage</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create wastage</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={warehousesLoading}>
                      <SelectValue placeholder={warehousesLoading ? "Loading…" : "Select a warehouse"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.data.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name}
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
              name="wastageDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createWastage.isPending}>
                {createWastage.isPending ? "Creating..." : "Create wastage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
