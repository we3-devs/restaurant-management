"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ClockIcon } from "lucide-react"

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
import { CardGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useEmployees } from "@/hooks/use-employees"
import { useOutlets } from "@/hooks/use-outlets"
import {
  useAssignShift,
  useCreateShift,
  useDeleteShift,
  useShiftAssignments,
  useShifts,
  useUnassignShift,
  type Shift,
} from "@/hooks/use-shifts"
import { assignShiftSchema, createShiftSchema, type AssignShiftInput, type CreateShiftInput } from "@/lib/validators/shifts"

export default function ShiftsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("shifts.manage")

  const [outletFilter, setOutletFilter] = useState("all")
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: shifts, isLoading } = useShifts(outletFilter !== "all" ? Number(outletFilter) : undefined)
  const showSkeleton = useDelayedLoading(isLoading)
  const deleteShift = useDeleteShift()

  async function handleDelete(id: number) {
    try {
      await deleteShift.mutateAsync(id)
      toast.success("Shift deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete shift")
    }
  }

  const isEmpty = !isLoading && (shifts?.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Shifts</h1>
        {canManage && <CreateShiftDialog />}
      </div>

      <div className="w-56 space-y-1.5">
        <label className="text-sm font-medium">Filter by outlet</label>
        <Select value={outletFilter} onValueChange={(v) => setOutletFilter(v ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All outlets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outlets</SelectItem>
            {outlets?.data.map((outlet) => (
              <SelectItem key={outlet.id} value={String(outlet.id)}>
                {outlet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <CardGridSkeleton count={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ClockIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No shifts found</p>
          <p className="text-sm text-muted-foreground">Create a shift to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shifts?.map((shift) => (
            <Card key={shift.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{shift.name}</CardTitle>
                  <Badge variant={shift.isActive ? "secondary" : "outline"}>
                    {shift.isActive ? "active" : "inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {shift.startTime} – {shift.endTime} · {shift.workingHours}h · {shift.breakDurationMinutes}min break
                </p>
                {shift.description && <p className="text-sm">{shift.description}</p>}
                <div className="flex items-center gap-2">
                  <ShiftAssignmentsDialog shift={shift} canManage={canManage} />
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="sm">Delete</Button>} />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete shift &quot;{shift.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone from the UI.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDelete(shift.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateShiftDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const createShift = useCreateShift()

  const defaultValues: CreateShiftInput = {
    name: "",
    slug: "",
    startTime: "09:00",
    endTime: "17:00",
    breakDurationMinutes: 30,
    workingHours: 8,
    description: "",
    outletId: 0,
  }

  const form = useForm<CreateShiftInput>({ resolver: zodResolver(createShiftSchema), defaultValues })

  async function onSubmit(values: CreateShiftInput) {
    try {
      await createShift.mutateAsync(values)
      toast.success("Shift created")
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create shift")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create shift</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create shift</DialogTitle>
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
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl {...field} placeholder="morning" />
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
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
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
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start time</FormLabel>
                  <FormControl type="time" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End time</FormLabel>
                  <FormControl type="time" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="breakDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Break (minutes)</FormLabel>
                  <FormControl
                    type="number"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="workingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Working hours</FormLabel>
                  <FormControl
                    type="number"
                    step="0.5"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={createShift.isPending}>
                {createShift.isPending ? "Creating..." : "Create shift"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ShiftAssignmentsDialog({ shift, canManage }: { shift: Shift; canManage: boolean }) {
  const [open, setOpen] = useState(false)
  const { data: employees } = useEmployees({ limit: 100, outletId: shift.outletId })
  const { data: assignments } = useShiftAssignments(shift.id)
  const assignShift = useAssignShift()
  const unassignShift = useUnassignShift(shift.id)

  const form = useForm<AssignShiftInput>({
    resolver: zodResolver(assignShiftSchema),
    defaultValues: { shiftId: shift.id, employeeId: 0, assignedDate: new Date().toISOString().slice(0, 10) },
  })

  const employeeName = (id: number) => employees?.data.find((e) => e.id === id)?.name ?? `#${id}`

  async function onSubmit(values: AssignShiftInput) {
    try {
      await assignShift.mutateAsync(values)
      toast.success("Employee assigned")
      form.reset({ shiftId: shift.id, employeeId: 0, assignedDate: values.assignedDate })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign employee")
    }
  }

  async function handleUnassign(id: number) {
    try {
      await unassignShift.mutateAsync(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unassign employee")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Assignments</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift.name} — assignments</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(assignments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No employees assigned.</p>}
            {(assignments ?? []).map((assignment) => (
              <div key={assignment.id} className="flex items-center gap-1.5">
                <Badge variant="secondary">
                  {employeeName(assignment.employeeId)} · {assignment.assignedDate}
                </Badge>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => handleUnassign(assignment.id)}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Employee</FormLabel>
                      <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees?.data.map((employee) => (
                            <SelectItem key={employee.id} value={String(employee.id)}>
                              {employee.name}
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
                  name="assignedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl type="date" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={assignShift.isPending}>
                  Assign
                </Button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
