"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateUnit } from "@/hooks/use-units"
import { createUnitSchema, type CreateUnitInput } from "@/lib/validators/units"

const unitTypes = ["weight", "volume", "quantity", "custom"] as const

export function CreateUnitDialog() {
  const [open, setOpen] = useState(false)
  const createUnit = useCreateUnit()

  const form = useForm<CreateUnitInput>({
    resolver: zodResolver(createUnitSchema),
    defaultValues: { name: "", shortName: "", type: "quantity" },
  })

  async function onSubmit(values: CreateUnitInput) {
    try {
      await createUnit.mutateAsync(values)
      toast.success(`Unit "${values.name}" created`)
      form.reset({ name: "", shortName: "", type: "quantity" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create unit")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create unit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create unit</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Kilogram" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shortName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short name</FormLabel>
                  <FormControl placeholder="kg" {...field} />
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitTypes.map((type) => (
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
            <DialogFooter>
              <Button type="submit" disabled={createUnit.isPending}>
                {createUnit.isPending ? "Creating..." : "Create unit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
