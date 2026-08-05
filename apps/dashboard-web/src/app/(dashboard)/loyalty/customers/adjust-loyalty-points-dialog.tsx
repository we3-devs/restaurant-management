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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCustomers } from "@/hooks/use-customers"
import { useAdjustLoyaltyPoints } from "@/hooks/use-loyalty"
import { adjustLoyaltyPointsSchema, type AdjustLoyaltyPointsInput } from "@/lib/validators/loyalty"

const defaultValues: AdjustLoyaltyPointsInput = {
  customerId: 0,
  delta: 0,
  notes: "",
}

export function AdjustLoyaltyPointsDialog() {
  const [open, setOpen] = useState(false)
  const { data: customers } = useCustomers({ limit: 100 })
  const adjustPoints = useAdjustLoyaltyPoints()

  const form = useForm<AdjustLoyaltyPointsInput>({
    resolver: zodResolver(adjustLoyaltyPointsSchema),
    defaultValues,
  })

  async function onSubmit(values: AdjustLoyaltyPointsInput) {
    try {
      await adjustPoints.mutateAsync({
        ...values,
        notes: values.notes || undefined,
      })
      toast.success("Points adjusted")
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to adjust points")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Adjust points</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust loyalty points</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.data.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.name}
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
              name="delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Points adjustment</FormLabel>
                  <FormControl
                    type="number"
                    step="1"
                    placeholder="Positive to add, negative to deduct"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={adjustPoints.isPending}>
                {adjustPoints.isPending ? "Saving..." : "Adjust points"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
