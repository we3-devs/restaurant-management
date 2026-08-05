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
import { useOutletDepartments } from "@/hooks/use-outlet-departments"
import { useCreateUser, useUsers } from "@/hooks/use-users"
import { useCreateEmployee, usePositions } from "@/hooks/use-employees"
import { createEmployeeSchema, type CreateEmployeeInput } from "@/lib/validators/employees"

const defaultValues: CreateEmployeeInput = {
  name: "",
  email: "",
  phone: "",
  outletId: 0,
  employmentStatus: "active",
  loginMode: "none",
  password: "",
}

export function CreateEmployeeDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: positions } = usePositions()
  const { data: users } = useUsers({ limit: 100 })
  const createUser = useCreateUser()
  const createEmployee = useCreateEmployee()

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues,
  })
  const selectedOutletId = form.watch("outletId")
  const loginMode = form.watch("loginMode")
  const { data: departments } = useOutletDepartments({ outletId: selectedOutletId || undefined, limit: 100 })

  async function onSubmit(values: CreateEmployeeInput) {
    const { loginMode, password, userId, ...employeeFields } = values
    try {
      let resolvedUserId = loginMode === "existing" ? userId : undefined
      if (loginMode === "new") {
        const user = await createUser.mutateAsync({ name: values.name, email: values.email!, password: password! })
        resolvedUserId = user.id
      }
      await createEmployee.mutateAsync({
        ...employeeFields,
        userId: resolvedUserId,
        email: values.email || undefined,
      })
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
                  <Select
                    items={outlets?.data.map((outlet) => ({ value: String(outlet.id), label: outlet.name }))}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(Number(v))
                      form.setValue("departmentId", undefined)
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
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    items={[
                      { value: "none", label: "No department" },
                      ...(departments?.data.map((department) => ({ value: String(department.id), label: department.name })) ?? []),
                    ]}
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                    disabled={!selectedOutletId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={selectedOutletId ? "Select a department" : "Select an outlet first"} />
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
              name="positionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <Select
                    items={[
                      { value: "none", label: "No position" },
                      ...(positions?.map((position) => ({ value: String(position.id), label: position.name })) ?? []),
                    ]}
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
              name="loginMode"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Login access</FormLabel>
                  <Select
                    items={[
                      { value: "none", label: "No login (can't sign in)" },
                      { value: "new", label: "Create a login now" },
                      { value: "existing", label: "Link an existing account" },
                    ]}
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      form.setValue("userId", undefined)
                      form.setValue("password", "")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No login (can&apos;t sign in)</SelectItem>
                      <SelectItem value="new">Create a login now</SelectItem>
                      <SelectItem value="existing">Link an existing account</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    What they can do once signed in comes from their position, not this.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {loginMode === "new" && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Login password</FormLabel>
                    <FormControl type="password" {...field} />
                    <p className="text-xs text-muted-foreground">Uses the email above as the login username.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {loginMode === "existing" && (
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Account to link</FormLabel>
                    <Select
                      items={users?.data.map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` }))}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.data.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
