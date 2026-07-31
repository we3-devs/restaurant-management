"use client"

import { useEffect } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlet } from "@/hooks/use-outlets"
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
  const { data: positions } = usePositions()
  const { data: outlet } = useOutlet(employee?.outletId ?? 0)
  const { data: performance } = useEmployeePerformance(employeeId)
  const updateEmployee = useUpdateEmployee(employeeId)
  const deleteEmployee = useDeleteEmployee()

  const form = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        positionId: employee.positionId ?? undefined,
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

  if (isLoading || !employee) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{employee.name}</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">
              {employee.employeeCode} · {outlet?.name ?? `Outlet #${employee.outletId}`}
            </p>
            <Badge variant={employee.employmentStatus === "active" ? "secondary" : "outline"}>
              {employee.employmentStatus}
            </Badge>
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
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
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
    </div>
  )
}
