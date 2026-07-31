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
import { useOutlets } from "@/hooks/use-outlets"
import { useCreateEmployee, usePositions } from "@/hooks/use-employees"
import { createEmployeeSchema, type CreateEmployeeInput } from "@/lib/validators/employees"

const defaultValues: CreateEmployeeInput = {
  name: "",
  email: "",
  phone: "",
  outletId: 0,
  employmentStatus: "active",
}

export function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: positions } = usePositions()
  const createEmployee = useCreateEmployee()

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues,
  })

  async function onSubmit(values: CreateEmployeeInput) {
    try {
      await createEmployee.mutateAsync({ ...values, email: values.email || undefined })
      toast.success("Employee created")
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create employee")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create employee</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create employee</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Name</FormLabel>
                  <FormControl {...field} />
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
              name="positionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No position</SelectItem>
                      {positions?.map((position) => (
                        <SelectItem key={position.id} value={String(position.id)}>
                          {position.name}
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl type="email" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="joiningDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Joining date</FormLabel>
                  <FormControl type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency phone</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending ? "Creating..." : "Create employee"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
