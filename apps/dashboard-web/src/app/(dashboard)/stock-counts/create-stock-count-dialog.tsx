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
import { useCreateStockCount } from "@/hooks/use-stock-counts"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createStockCountSchema, type CreateStockCountInput } from "@/lib/validators/stock-counts"

export function CreateStockCountDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createCount = useCreateStockCount()

  const form = useForm<CreateStockCountInput>({
    resolver: zodResolver(createStockCountSchema),
    defaultValues: { warehouseId: 0, countDate: new Date().toISOString().slice(0, 10) },
  })

  async function onSubmit(values: CreateStockCountInput) {
    try {
      const count = await createCount.mutateAsync(values)
      toast.success(`Count "${count.countNo}" created`)
      setOpen(false)
      router.push(`/stock-counts/${count.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create count")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create count</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stock count</DialogTitle>
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
              name="countDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createCount.isPending}>
                {createCount.isPending ? "Creating..." : "Create count"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
