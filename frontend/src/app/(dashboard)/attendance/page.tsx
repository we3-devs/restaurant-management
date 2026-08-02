"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { CalendarClockIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useEmployees } from "@/hooks/use-employees"
import { useOutlets } from "@/hooks/use-outlets"
import {
  useAttendanceList,
  useClockIn,
  useClockOut,
  type Attendance,
} from "@/hooks/use-attendance"
import { ATTENDANCE_STATUSES, clockInSchema, type ClockInInput } from "@/lib/validators/attendance"

const PAGE_SIZE = 10

export default function AttendancePage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("attendance.manage")

  const [outletFilter, setOutletFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange>({ dateFrom: "", dateTo: "" })
  const [page, setPage] = useState(1)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: employees } = useEmployees({ limit: 200 })
  const { data, isLoading, isPlaceholderData } = useAttendanceList({
    page,
    limit: PAGE_SIZE,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    dateFrom: dateRange.dateFrom || undefined,
    dateTo: dateRange.dateTo || undefined,
  })
  const clockOut = useClockOut()

  const employeeName = (id: number) => employees?.data.find((e) => e.id === id)?.name ?? `#${id}`

  async function handleClockOut(attendanceId: number) {
    try {
      await clockOut.mutateAsync({ attendanceId })
      toast.success("Clocked out")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clock out")
    }
  }

  const columns = useMemo<ColumnDef<Attendance>[]>(
    () => [
      { id: "employee", header: "Employee", cell: ({ row }) => employeeName(row.original.employeeId) },
      { id: "clockIn", header: "Clock in", cell: ({ row }) => new Date(row.original.clockIn).toLocaleString() },
      {
        id: "clockOut",
        header: "Clock out",
        cell: ({ row }) => (row.original.clockOut ? new Date(row.original.clockOut).toLocaleString() : "—"),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      { id: "workingHours", header: "Hours", cell: ({ row }) => row.original.workingHours.toFixed(2) },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          canManage && !row.original.clockOut ? (
            <Button variant="ghost" size="sm" onClick={() => handleClockOut(row.original.id)}>
              Clock out
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, canManage],
  )

  const table = useReactTable({ data: data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() })
  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Attendance</h1>
        {canManage && <ClockInDialog />}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by outlet</label>
          <Select value={outletFilter} onValueChange={(v) => { setOutletFilter(v ?? "all"); setPage(1) }}>
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
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by status</label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1) }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ATTENDANCE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter
          value={dateRange}
          onChange={(value) => {
            setDateRange(value)
            setPage(1)
          }}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <CalendarClockIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No attendance records found</p>
          <p className="text-sm text-muted-foreground">Clock in an employee to get started.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <DataTablePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function ClockInDialog() {
  const [open, setOpen] = useState(false)
  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: employees } = useEmployees({ limit: 200 })
  const clockIn = useClockIn()

  const defaultValues: ClockInInput = { employeeId: 0, outletId: 0 }
  const form = useForm<ClockInInput>({ resolver: zodResolver(clockInSchema), defaultValues })

  async function onSubmit(values: ClockInInput) {
    try {
      await clockIn.mutateAsync(values)
      toast.success("Employee clocked in")
      form.reset(defaultValues)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clock in")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Clock in</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clock in employee</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
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
            <DialogFooter>
              <Button type="submit" disabled={clockIn.isPending}>
                {clockIn.isPending ? "Clocking in..." : "Clock in"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
