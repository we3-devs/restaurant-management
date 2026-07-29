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
import { useCreateStockIn } from "@/hooks/use-stock-ins"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createStockInSchema, type CreateStockInInput } from "@/lib/validators/stock-ins"

const sources = ["purchase", "return", "correction", "donation", "other", "transfer"] as const

export function CreateStockInDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: warehouses } = useWarehouses({ limit: 100 })
  const createStockIn = useCreateStockIn()

  const form = useForm<CreateStockInInput>({
    resolver: zodResolver(createStockInSchema),
    defaultValues: { warehouseId: 0, stockInDate: new Date().toISOString().slice(0, 10), source: "purchase" },
  })

  async function onSubmit(values: CreateStockInInput) {
    try {
      const stockIn = await createStockIn.mutateAsync(values)
      toast.success(`Stock-in "${stockIn.stockInNo}" created`)
      setOpen(false)
      router.push(`/stock-ins/${stockIn.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create stock-in")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create stock-in</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stock-in</DialogTitle>
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a warehouse" />
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
              name="stockInDate"
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
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createStockIn.isPending}>
                {createStockIn.isPending ? "Creating..." : "Create stock-in"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
