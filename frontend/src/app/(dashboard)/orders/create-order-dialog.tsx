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
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateOrder } from "@/hooks/use-orders"
import { useOutlets } from "@/hooks/use-outlets"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { ORDER_TYPES, createOrderSchema, type CreateOrderInput } from "@/lib/validators/orders"

export function CreateOrderDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const createOrder = useCreateOrder()

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { outletId: 0, tableSessionId: undefined, orderType: "dine_in" },
  })

  const selectedOutletId = form.watch("outletId")
  const orderType = form.watch("orderType")
  const { data: sessions } = useTableSessions({
    outletId: selectedOutletId || undefined,
    status: "active",
    limit: 100,
  })

  async function onSubmit(values: CreateOrderInput) {
    try {
      await createOrder.mutateAsync(values)
      toast.success("Order created")
      form.reset({ outletId: 0, tableSessionId: undefined, orderType: "dine_in" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create order")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create order</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create order</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="outletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => {
                      field.onChange(Number(value))
                      form.setValue("tableSessionId", undefined)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an outlet" />
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
              name="orderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.map((type) => (
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
            {orderType === "dine_in" && (
              <FormField
                control={form.control}
                name="tableSessionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Table session (optional)</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                      disabled={!selectedOutletId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No table session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No table session</SelectItem>
                        {sessions?.data.map((session) => (
                          <SelectItem key={session.id} value={String(session.id)}>
                            Session #{session.id} (table #{session.diningTableId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending ? "Creating..." : "Create order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
