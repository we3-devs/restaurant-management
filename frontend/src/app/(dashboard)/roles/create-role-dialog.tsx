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
import { useCreateRole } from "@/hooks/use-roles"
import { createRoleSchema, type CreateRoleInput } from "@/lib/validators/roles"

export function CreateRoleDialog() {
  const [open, setOpen] = useState(false)
  const createRole = useCreateRole()

  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "", slug: "", description: "" },
  })

  async function onSubmit(values: CreateRoleInput) {
    try {
      await createRole.mutateAsync(values)
      toast.success(`Role "${values.name}" created`)
      form.reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create role")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Shift Manager" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl placeholder="shift-manager" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createRole.isPending}>
                {createRole.isPending ? "Creating..." : "Create role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
