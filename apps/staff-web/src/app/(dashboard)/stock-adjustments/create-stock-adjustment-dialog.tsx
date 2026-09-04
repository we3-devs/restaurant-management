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
import { useCreateStockAdjustment } from "@/hooks/use-stock-adjustments"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createStockAdjustmentSchema, type CreateStockAdjustmentInput } from "@/lib/validators/stock-adjustments"

export function CreateStockAdjustmentDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createAdjustment = useCreateStockAdjustment()

  const form = useForm<CreateStockAdjustmentInput>({
    resolver: zodResolver(createStockAdjustmentSchema),
    defaultValues: { warehouseId: 0, adjustmentDate: new Date().toISOString().slice(0, 10), reason: "" },
  })

  async function onSubmit(values: CreateStockAdjustmentInput) {
    try {
      const adjustment = await createAdjustment.mutateAsync(values)
      toast.success(`Adjustment "${adjustment.adjustmentNo}" created`)
      setOpen(false)
      router.push(`/stock-adjustments/${adjustment.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create adjustment")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create adjustment</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stock adjustment</DialogTitle>
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
              name="adjustmentDate"
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
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl placeholder="Physical recount" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createAdjustment.isPending}>
                {createAdjustment.isPending ? "Creating..." : "Create adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
