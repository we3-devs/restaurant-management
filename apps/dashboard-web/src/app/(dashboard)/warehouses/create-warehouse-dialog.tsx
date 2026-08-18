"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOutletDepartments } from "@/hooks/use-outlet-departments"
import { useOutlets } from "@/hooks/use-outlets"
import { useCreateWarehouse } from "@/hooks/use-warehouses"
import { createWarehouseSchema, type CreateWarehouseInput } from "@/lib/validators/warehouses"

export function CreateWarehouseDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets, isLoading: outletsLoading } = useOutlets({ limit: 100 })
  const createWarehouse = useCreateWarehouse()

  const form = useForm<CreateWarehouseInput>({
    resolver: zodResolver(createWarehouseSchema),
    defaultValues: { outletId: 0, outletDepartmentId: undefined, name: "", code: "", isDefault: false },
  })

  const selectedOutletId = form.watch("outletId")
  const { data: departments, isLoading: departmentsLoading } = useOutletDepartments({
    outletId: selectedOutletId || undefined,
    limit: 100,
  })

  async function onSubmit(values: CreateWarehouseInput) {
    try {
      await createWarehouse.mutateAsync(values)
      toast.success(`Warehouse "${values.name}" created`)
      form.reset({ outletId: 0, outletDepartmentId: undefined, name: "", code: "", isDefault: false })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create warehouse")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create warehouse</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create warehouse</DialogTitle>
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
                      form.setValue("outletDepartmentId", undefined)
                    }}
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
              name="outletDepartmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department (optional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                    disabled={!selectedOutletId}
                  >
                    <SelectTrigger className="w-full" disabled={departmentsLoading}>
                      <SelectValue placeholder={departmentsLoading ? "Loading…" : "No department"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments?.data.map((department) => (
                        <SelectItem key={department.id} value={String(department.id)}>
                          {department.name}
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
                  <FormControl placeholder="Main Store" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl placeholder="WH-01" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isDefault"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="isDefault">Default warehouse for this outlet</Label>
                </div>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createWarehouse.isPending}>
                {createWarehouse.isPending ? "Creating..." : "Create warehouse"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
