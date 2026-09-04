"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOutlets } from "@/hooks/use-outlets"
import { useSuppliers } from "@/hooks/use-suppliers"
import { useWarehouses } from "@/hooks/use-warehouses"
import { useCreatePurchaseOrder } from "@/hooks/use-purchase-orders"
import { createPurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/lib/validators/purchase-orders"

const defaultValues: CreatePurchaseOrderInput = {
  supplierId: 0,
  outletId: 0,
  warehouseId: 0,
  expectedDeliveryDate: "",
  currency: "NPR",
  notes: "",
}

export function CreatePurchaseOrderDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { data: outlets, isLoading: outletsLoading } = useOutlets({ limit: 100 })
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers({ limit: 100 })
  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses({ limit: 100 })
  const createPurchaseOrder = useCreatePurchaseOrder()

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues,
  })

  async function onSubmit(values: CreatePurchaseOrderInput) {
    try {
      const po = await createPurchaseOrder.mutateAsync({
        ...values,
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
      })
      toast.success("Purchase order created")
      form.reset(defaultValues)
      setOpen(false)
      router.push(`/dashboard/purchase-orders/${po.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create purchase order")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create purchase order</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Supplier</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={suppliersLoading}>
                      <SelectValue placeholder={suppliersLoading ? "Loading…" : "Select a supplier"} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.data.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.companyName}
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
              name="outletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={outletsLoading}>
                      <SelectValue placeholder={outletsLoading ? "Loading…" : "Select an outlet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets?.data.map((outlet) => (
                        <SelectItem key={outlet.id} value={String(outlet.id)}>
                          {outlet.name}
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
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full" disabled={warehousesLoading}>
                      <SelectValue placeholder={warehousesLoading ? "Loading…" : "Select a warehouse"} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.data.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.name}
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
              name="expectedDeliveryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected delivery</FormLabel>
                  <FormControl type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={createPurchaseOrder.isPending}>
                {createPurchaseOrder.isPending ? "Creating..." : "Create draft"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
