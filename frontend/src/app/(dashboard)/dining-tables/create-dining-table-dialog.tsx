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
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useCreateDiningTable } from "@/hooks/use-dining-tables"
import { useOutlets } from "@/hooks/use-outlets"
import { createDiningTableSchema, type CreateDiningTableInput } from "@/lib/validators/dining-tables"

export function CreateDiningTableDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const createDiningTable = useCreateDiningTable()

  const form = useForm<CreateDiningTableInput>({
    resolver: zodResolver(createDiningTableSchema),
    defaultValues: { outletId: 0, diningAreaId: 0, name: "", code: "", capacity: 1 },
  })

  const selectedOutletId = form.watch("outletId")
  const { data: areas } = useDiningAreas({ outletId: selectedOutletId || undefined, limit: 100 })

  async function onSubmit(values: CreateDiningTableInput) {
    try {
      await createDiningTable.mutateAsync(values)
      toast.success(`Table "${values.name}" created`)
      form.reset({ outletId: 0, diningAreaId: 0, name: "", code: "", capacity: 1 })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create table")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create table</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create dining table</DialogTitle>
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
                      form.setValue("diningAreaId", 0)
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
              name="diningAreaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dining area</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={!selectedOutletId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a dining area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas?.data.map((area) => (
                        <SelectItem key={area.id} value={String(area.id)}>
                          {area.name}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="T1" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createDiningTable.isPending}>
                {createDiningTable.isPending ? "Creating..." : "Create table"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
