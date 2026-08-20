"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlet, useOutlets } from "@/hooks/use-outlets"
import { useOutletDepartments } from "@/hooks/use-outlet-departments"
import { useUserRoleAssignments, useUsers } from "@/hooks/use-users"
import {
  useDeleteEmployee,
  useEmployee,
  useEmployeePerformance,
  usePositions,
  useUpdateEmployee,
} from "@/hooks/use-employees"
import { EMPLOYMENT_STATUSES, updateEmployeeSchema, type UpdateEmployeeInput } from "@/lib/validators/employees"

export function EmployeeDetail({ employeeId }: { employeeId: number }) {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("employees.manage")

  const { data: employee, isLoading } = useEmployee(employeeId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: positions } = usePositions()
  const { data: users } = useUsers({ limit: 100 })
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: outlet } = useOutlet(employee?.outletId ?? 0)
  const { data: performance } = useEmployeePerformance(employeeId)
  const linkedUser = users?.data.find((u) => u.id === employee?.userId)
  const { data: roleAssignments } = useUserRoleAssignments(employee?.userId ?? 0)
  const activeRoleAssignments = (roleAssignments ?? []).filter((assignment) => assignment.isActive)
  const updateEmployee = useUpdateEmployee(employeeId)
  const deleteEmployee = useDeleteEmployee()

  const form = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      userId: undefined,
      positionId: undefined,
      outletId: undefined,
      departmentId: undefined,
      joiningDate: "",
      employmentStatus: "active",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
    },
  })
  const selectedOutletId = form.watch("outletId")
  const selectedPositionId = form.watch("positionId")
  const { data: departments } = useOutletDepartments({ outletId: selectedOutletId, limit: 100 })
  const currentDepartment = departments?.data.find((d) => d.id === employee?.departmentId)
  const selectedPosition = positions?.find((position) => position.id === selectedPositionId)
  const isAdminRole = selectedPosition?.defaultRole?.level === "global"

  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        userId: employee.userId ?? undefined,
        positionId: employee.positionId ?? undefined,
        outletId: employee.outletId,
        departmentId: employee.departmentId ?? undefined,
        joiningDate: employee.joiningDate ?? "",
        employmentStatus: employee.employmentStatus,
        emergencyContactName: employee.emergencyContactName ?? "",
        emergencyContactPhone: employee.emergencyContactPhone ?? "",
        emergencyContactRelation: employee.emergencyContactRelation ?? "",
      })
    }
  }, [employee, form])

  async function onSubmit(values: UpdateEmployeeInput) {
    try {
      await updateEmployee.mutateAsync({ ...values, email: values.email || undefined })
      toast.success("Employee updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update employee")
    }
  }

  async function handleDelete() {
    try {
      await deleteEmployee.mutateAsync(employeeId)
      toast.success("Employee deleted")
      router.push("/employees")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete employee")
    }
  }

  if (showSkeleton) return <DetailPageSkeleton fields={6} />
  if (!isLoading && !employee) return <NotFoundCard resource="Employee" />
  if (!employee) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{employee.name}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">
              {employee.employeeCode} · {outlet?.name ?? "Loading…"}
              {employee.departmentId && ` · ${currentDepartment?.name ?? "Loading…"}`}
            </p>
            <Badge variant={employee.employmentStatus === "active" ? "secondary" : "outline"}>
              {employee.employmentStatus}
            </Badge>
            {employee.userId ? (
              <Badge variant="outline">
                Login: {linkedUser ? linkedUser.email : `user #${employee.userId}`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">No login account</Badge>
            )}
          </div>
        </div>
        {canManage && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete employee &quot;{employee.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {performance && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders served</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{performance.ordersServed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales generated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{performance.salesGenerated.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Working hours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{performance.workingHours.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Late count</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{performance.lateCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl {...field} disabled={!canManage} />
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
                      onValueChange={(v) => {
                        field.onChange(v === "none" ? undefined : Number(v))
                        form.setValue("departmentId", undefined)
                      }}
                      disabled={!canManage}
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
                name="outletId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outlet</FormLabel>
                    <Select
                      items={outlets?.data.map((o) => ({ value: String(o.id), label: o.name }))}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v))
                        form.setValue("departmentId", undefined)
                      }}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets?.data.map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isAdminRole && (
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
                        disabled={!canManage || !selectedOutletId}
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
              )}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked user account</FormLabel>
                    <Select
                      items={[
                        { value: "none", label: "No login account" },
                        ...(users?.data.map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` })) ?? []),
                      ]}
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No login account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No login account</SelectItem>
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
              <FormField
                control={form.control}
                name="employmentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
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
                    <FormControl {...field} disabled={!canManage} />
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
                    <FormControl type="email" {...field} disabled={!canManage} />
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
                    <FormControl type="date" {...field} disabled={!canManage} />
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
                    <FormControl {...field} disabled={!canManage} />
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
                    <FormControl {...field} disabled={!canManage} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canManage && (
                <Button type="submit" disabled={updateEmployee.isPending} className="col-span-2 w-fit">
                  {updateEmployee.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {employee.userId && (
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Access is granted by the linked account&apos;s role assignments, not by the position above — a user can
              hold more than one role at once.
            </p>
            <div className="flex flex-wrap gap-2">
              {activeRoleAssignments.length === 0 && (
                <p className="text-sm text-muted-foreground">No active role assignments.</p>
              )}
              {activeRoleAssignments.map((assignment) => (
                <Badge key={assignment.id} variant="secondary">
                  {assignment.roleName}
                </Badge>
              ))}
            </div>
            {canManage && (
              <Link href={`/users/${employee.userId}`} className="text-sm text-primary underline underline-offset-4">
                Manage roles on the linked account
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
