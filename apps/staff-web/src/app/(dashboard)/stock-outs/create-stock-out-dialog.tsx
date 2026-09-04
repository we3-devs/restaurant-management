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
import { useCreateStockOut } from "@/hooks/use-stock-outs"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createStockOutSchema, type CreateStockOutInput } from "@/lib/validators/stock-outs"

const purposes = ["production_use", "kitchen_use", "sample", "distribution", "other", "transfer"] as const

export function CreateStockOutDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createStockOut = useCreateStockOut()

  const form = useForm<CreateStockOutInput>({
    resolver: zodResolver(createStockOutSchema),
    defaultValues: { warehouseId: 0, stockOutDate: new Date().toISOString().slice(0, 10), purpose: "kitchen_use" },
  })

  async function onSubmit(values: CreateStockOutInput) {
    try {
      const stockOut = await createStockOut.mutateAsync(values)
      toast.success(`Stock-out "${stockOut.stockOutNo}" created`)
      setOpen(false)
      router.push(`/stock-outs/${stockOut.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create stock-out")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create stock-out</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stock-out</DialogTitle>
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
              name="stockOutDate"
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
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {purposes.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createStockOut.isPending}>
                {createStockOut.isPending ? "Creating..." : "Create stock-out"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
