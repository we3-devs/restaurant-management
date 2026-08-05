"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useOutlets } from "@rms/api-client/hooks/use-outlets"
import { useStartTableSession } from "@rms/api-client/hooks/use-table-sessions"
import { createTableSessionSchema, type CreateTableSessionInput } from "@rms/validators/table-sessions"

export function StartTableSessionDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const startSession = useStartTableSession()

  const form = useForm<CreateTableSessionInput>({
    resolver: zodResolver(createTableSessionSchema),
    defaultValues: { outletId: 0, diningTableId: 0, guestCount: 1 },
  })

  const selectedOutletId = form.watch("outletId")
  const { data: tables } = useDiningTables({
    outletId: selectedOutletId || undefined,
    status: "available",
    limit: 100,
  })

  async function onSubmit(values: CreateTableSessionInput) {
    try {
      await startSession.mutateAsync(values)
      toast.success("Table session started")
      form.reset({ outletId: 0, diningTableId: 0, guestCount: 1 })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start session")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Start session</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a table session</DialogTitle>
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
                      form.setValue("diningTableId", 0)
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
              name="diningTableId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table (available only)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                    disabled={!selectedOutletId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables?.data.map((tableItem) => (
                        <SelectItem key={tableItem.id} value={String(tableItem.id)}>
                          {tableItem.name}
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
              name="guestCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest count</FormLabel>
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
              <Button type="submit" disabled={startSession.isPending}>
                {startSession.isPending ? "Starting..." : "Start session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
