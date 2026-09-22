"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useCreateInventoryKit } from "@/hooks/use-inventory-kits"
import { createInventoryKitSchema, type CreateInventoryKitInput } from "@/lib/validators/inventory-kits"

export function CreateInventoryKitDialog() {
  const [open, setOpen] = useState(false)
  const createKit = useCreateInventoryKit()

  const form = useForm<CreateInventoryKitInput>({
    resolver: zodResolver(createInventoryKitSchema),
    defaultValues: { name: "", description: "" },
  })

  async function onSubmit(values: CreateInventoryKitInput) {
    try {
      await createKit.mutateAsync(values)
      toast.success(`Kit "${values.name}" created`)
      form.reset({ name: "", description: "" })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create kit")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create kit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create inventory kit</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="8848" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl placeholder="Premium whisky, sold in multiple bottle sizes" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createKit.isPending}>
                {createKit.isPending ? "Creating..." : "Create kit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
