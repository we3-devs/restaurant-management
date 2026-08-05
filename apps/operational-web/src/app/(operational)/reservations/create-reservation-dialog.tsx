"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@rms/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@rms/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@rms/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rms/ui/select"
import { useCustomers } from "@rms/api-client/hooks/use-customers"
import { useDiningAreas } from "@rms/api-client/hooks/use-dining-areas"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useOutlets } from "@rms/api-client/hooks/use-outlets"
import { useCreateReservation, type Reservation } from "@rms/api-client/hooks/use-reservations"
import { apiClient } from "@rms/api-client/client"
import { queryKeys } from "@rms/api-client/query-keys"
import { createReservationSchema, type CreateReservationInput } from "@rms/validators/reservations"

export function CreateReservationDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: customers } = useCustomers({ limit: 100 })
  const createReservation = useCreateReservation()
  const queryClient = useQueryClient()

  const [diningAreaId, setDiningAreaId] = useState("")
  const [diningTableId, setDiningTableId] = useState("")

  const form = useForm<CreateReservationInput>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      outletId: 0,
      customerId: 0,
      reservedAt: "",
      guestCount: 2,
      source: "staff",
      depositAmount: 0,
      specialRequest: "",
      internalNote: "",
    },
  })

  const outletId = form.watch("outletId")
  const { data: areas } = useDiningAreas({ outletId: outletId || undefined, limit: 100 })
  const { data: tables } = useDiningTables({
    outletId: outletId || undefined,
    diningAreaId: diningAreaId ? Number(diningAreaId) : undefined,
    limit: 100,
  })

  function resetAll() {
    form.reset({
      outletId: 0,
      customerId: 0,
      reservedAt: "",
      guestCount: 2,
      source: "staff",
      depositAmount: 0,
      specialRequest: "",
      internalNote: "",
    })
    setDiningAreaId("")
    setDiningTableId("")
  }

  async function onSubmit(values: CreateReservationInput) {
    try {
      const reservation = await createReservation.mutateAsync({
        ...values,
        reservedAt: new Date(values.reservedAt).toISOString(),
      })
      if (diningTableId) {
        await apiClient<Reservation>(`/reservations/${reservation.id}/tables`, {
          method: "POST",
          body: JSON.stringify({ diningTableId: Number(diningTableId) }),
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.reservations.tables(reservation.id) })
      }
      toast.success("Reservation created")
      resetAll()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create reservation")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create reservation</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create reservation</DialogTitle>
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
                      setDiningAreaId("")
                      setDiningTableId("")
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

            {outletId > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FormLabel>Dining area</FormLabel>
                  <Select
                    value={diningAreaId}
                    onValueChange={(value) => {
                      setDiningAreaId(value ?? "")
                      setDiningTableId("")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Any area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas?.data.map((area) => (
                        <SelectItem key={area.id} value={String(area.id)}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FormLabel>Table (optional)</FormLabel>
                  <Select value={diningTableId} onValueChange={(value) => setDiningTableId(value ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Assign later" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables?.data.map((table) => (
                        <SelectItem key={table.id} value={String(table.id)}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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
              name="reservedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reserved for</FormLabel>
                  <FormControl type="datetime-local" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guests</FormLabel>
                  <FormControl
                    type="number"
                    step="1"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="depositAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reservation amount (deposit)</FormLabel>
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
              name="specialRequest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special request (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal note (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createReservation.isPending}>
                {createReservation.isPending ? "Creating..." : "Create reservation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
