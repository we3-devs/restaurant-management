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
import { useCreateStockTransfer } from "@/hooks/use-stock-transfers"
import { useWarehouses } from "@/hooks/use-warehouses"
import { createStockTransferSchema, type CreateStockTransferInput } from "@/lib/validators/stock-transfers"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"

export function CreateStockTransferDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { outlets } = useActiveOutlet()
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createTransfer = useCreateStockTransfer()

  const form = useForm<CreateStockTransferInput>({
    resolver: zodResolver(createStockTransferSchema),
    defaultValues: { fromWarehouseId: 0, toWarehouseId: 0, transferDate: new Date().toISOString().slice(0, 10) },
  })

  async function onSubmit(values: CreateStockTransferInput) {
    try {
      const transfer = await createTransfer.mutateAsync(values)
      toast.success(`Transfer "${transfer.transferNo}" created`)
      setOpen(false)
      router.push(`/dashboard/stock-transfers/${transfer.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create transfer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create transfer</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stock transfer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fromWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From warehouse</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={warehousesLoading}>
                      <SelectValue placeholder={warehousesLoading ? "Loading…" : "Select a warehouse"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.data.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name} — {outlets.find((outlet) => outlet.id === warehouse.outletId)?.name ?? `Outlet #${warehouse.outletId}`}
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
              name="toWarehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To warehouse</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={warehousesLoading}>
                      <SelectValue placeholder={warehousesLoading ? "Loading…" : "Select a warehouse"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.data.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name} — {outlets.find((outlet) => outlet.id === warehouse.outletId)?.name ?? `Outlet #${warehouse.outletId}`}
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
              name="transferDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createTransfer.isPending}>
                {createTransfer.isPending ? "Creating..." : "Create transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
