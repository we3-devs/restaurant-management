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
import { useCreateOutlet } from "@/hooks/use-outlets"
import { createOutletSchema, type CreateOutletInput } from "@/lib/validators/outlets"

export function CreateOutletDialog() {
  const [open, setOpen] = useState(false)
  const createOutlet = useCreateOutlet()

  const form = useForm<CreateOutletInput>({
    resolver: zodResolver(createOutletSchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: CreateOutletInput) {
    try {
      await createOutlet.mutateAsync(values)
      toast.success(`Outlet "${values.name}" created`)
      form.reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create outlet")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create outlet</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create outlet</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Downtown Branch" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createOutlet.isPending}>
                {createOutlet.isPending ? "Creating..." : "Create outlet"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
