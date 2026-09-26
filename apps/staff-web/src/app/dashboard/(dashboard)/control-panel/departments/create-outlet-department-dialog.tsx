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
import { useCreateOutletDepartment } from "@/hooks/use-outlet-departments"
import { useOutlets } from "@/hooks/use-outlets"
import {
  createOutletDepartmentSchema,
  OUTLET_DEPARTMENT_TYPES,
  type CreateOutletDepartmentInput,
} from "@/lib/validators/outlet-departments"

export function CreateOutletDepartmentDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets, isLoading: outletsLoading } = useOutlets({ limit: 100 })
  const createOutletDepartment = useCreateOutletDepartment()

  const form = useForm<CreateOutletDepartmentInput>({
    resolver: zodResolver(createOutletDepartmentSchema),
    defaultValues: { outletId: 0, name: "", code: "", type: "other" },
  })

  async function onSubmit(values: CreateOutletDepartmentInput) {
    try {
      await createOutletDepartment.mutateAsync(values)
      toast.success(`Department "${values.name}" created`)
      form.reset({ outletId: 0, name: "", code: "", type: "other" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create department")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create department</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create outlet department</DialogTitle>
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
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Main Kitchen" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTLET_DEPARTMENT_TYPES.map((type) => (
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
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (optional)</FormLabel>
                  <FormControl placeholder="KIT-01" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createOutletDepartment.isPending}>
                {createOutletDepartment.isPending ? "Creating..." : "Create department"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
