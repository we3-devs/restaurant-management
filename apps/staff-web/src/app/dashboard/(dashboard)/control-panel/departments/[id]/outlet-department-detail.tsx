"use client"

import { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPageSkeleton, NotFoundCard } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import {
  useAssignDepartmentEmployee,
  useDeleteOutletDepartment,
  useDepartmentEmployees,
  useOutletDepartment,
  useRemoveDepartmentEmployee,
  useUpdateOutletDepartment,
} from "@/hooks/use-outlet-departments"
import { useEmployees } from "@/hooks/use-employees"
import { useOutlet } from "@/hooks/use-outlets"
import { usePageTitle } from "@rms/ui/use-page-title"
import {
  OUTLET_DEPARTMENT_TYPES,
  updateOutletDepartmentSchema,
  type UpdateOutletDepartmentInput,
} from "@/lib/validators/outlet-departments"

export function OutletDepartmentDetail({ departmentId }: { departmentId: number }) {
  const router = useRouter()
  const { permissions } = useCurrentUser()
  const canManage = permissions.includes("outlet-departments.manage")
  const { data: department, isLoading } = useOutletDepartment(departmentId)
  const showSkeleton = useDelayedLoading(isLoading)
  const { data: outlet } = useOutlet(department?.outletId ?? 0)
  const updateDepartment = useUpdateOutletDepartment(departmentId)
  const deleteDepartment = useDeleteOutletDepartment()
  const { data: departmentEmployees = [] } = useDepartmentEmployees(departmentId)
  const { data: outletEmployees } = useEmployees({ outletId: department?.outletId, limit: 100 })
  const assignEmployee = useAssignDepartmentEmployee(departmentId)
  const removeEmployee = useRemoveDepartmentEmployee(departmentId)
  const [employeeToAdd, setEmployeeToAdd] = useState("")

  const form = useForm<UpdateOutletDepartmentInput>({
    resolver: zodResolver(updateOutletDepartmentSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "other",
      description: "",
      canPrepareOrder: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (department) {
      form.reset({
        name: department.name,
        code: department.code ?? "",
        type: department.type as UpdateOutletDepartmentInput["type"],
        description: department.description ?? "",
        canPrepareOrder: department.canPrepareOrder,
        isActive: department.isActive,
      })
    }
  }, [department, form])

  async function onSubmit(values: UpdateOutletDepartmentInput) {
    try {
      await updateDepartment.mutateAsync(values)
      toast.success("Department updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update department")
    }
  }

  async function handleDelete() {
    try {
      await deleteDepartment.mutateAsync(departmentId)
      toast.success("Department deleted")
      router.push("/dashboard/control-panel/departments")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete department")
    }
  }

  usePageTitle("Outlet Department Details")

  if (showSkeleton) return <DetailPageSkeleton fields={5} />
  if (!isLoading && !department) return <NotFoundCard resource="Outlet department" />
  if (!department) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{department.name}</h1>
          <p className="text-sm text-muted-foreground">{outlet?.name ?? "Loading…"}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete department &quot;{department.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>This soft-deletes the department. This cannot be undone from the UI.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl {...field} />
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
                    <FormLabel>Code</FormLabel>
                    <FormControl {...field} />
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
                    <FormControl {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canPrepareOrder"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="canPrepareOrder"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="canPrepareOrder">Can prepare orders</Label>
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                )}
              />
              <Button type="submit" disabled={updateDepartment.isPending}>
                {updateDepartment.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned staff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Assign staff members from {outlet?.name ?? "this outlet"} to this department.</p>
          {canManage && (
            <Select
              items={(outletEmployees?.data ?? [])
                .filter((employee) => !departmentEmployees.some((assigned) => assigned.id === employee.id))
                .map((employee) => ({ value: String(employee.id), label: employee.name }))}
              value={employeeToAdd}
              onValueChange={async (value) => {
                const nextValue = value ?? ""
                setEmployeeToAdd(nextValue)
                if (!nextValue) return
                try {
                  await assignEmployee.mutateAsync(Number(nextValue))
                  toast.success("Staff member assigned")
                  setEmployeeToAdd("")
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to assign staff member")
                }
              }}
              disabled={assignEmployee.isPending}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Add a staff member" />
              </SelectTrigger>
              <SelectContent>
                {(outletEmployees?.data ?? [])
                  .filter((employee) => !departmentEmployees.some((assigned) => assigned.id === employee.id))
                  .map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{employee.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex flex-wrap gap-2">
            {departmentEmployees.length === 0 && <p className="text-sm text-muted-foreground">No staff assigned.</p>}
            {departmentEmployees.map((employee) => (
              <div key={employee.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span>{employee.name}</span>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await removeEmployee.mutateAsync(employee.id)
                        toast.success("Staff member removed")
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to remove staff member")
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
