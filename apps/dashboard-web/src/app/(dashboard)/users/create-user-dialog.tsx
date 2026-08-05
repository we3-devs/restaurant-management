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
import { useRoles } from "@/hooks/use-roles"
import { useCreateUserWithRole } from "@/hooks/use-users"
import { createUserWithRoleSchema, type CreateUserWithRoleInput } from "@/lib/validators/users"

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const createUser = useCreateUserWithRole()
  // Only roles meant to be handed out directly, cheapest-access-first — keeps this dropdown a short, unintimidating list instead of every role in the system.
  const { data: roles } = useRoles({ limit: 100 })
  const assignableRoles = (roles?.data ?? [])
    .filter((role) => role.isAssignable && role.isActive)
    .sort((a, b) => b.rank - a.rank)

  const form = useForm<CreateUserWithRoleInput>({
    resolver: zodResolver(createUserWithRoleSchema),
    defaultValues: { name: "", email: "", password: "", roleId: undefined },
  })

  async function onSubmit(values: CreateUserWithRoleInput) {
    try {
      await createUser.mutateAsync(values)
      toast.success(`User "${values.name}" created`)
      form.reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create user</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl placeholder="Jane Doe" {...field} />
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
                  <FormControl type="email" placeholder="jane@rms.local" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial password</FormLabel>
                  <FormControl type="password" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    items={[
                      { value: "none", label: "No role yet" },
                      ...assignableRoles.map((role) => ({ value: String(role.id), label: role.name })),
                    ]}
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No role yet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role yet</SelectItem>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Controls what this account can see and do. You can change it later from the user&apos;s page.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
