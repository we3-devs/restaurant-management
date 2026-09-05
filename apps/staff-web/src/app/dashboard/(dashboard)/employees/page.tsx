"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useOutlets } from "@/hooks/use-outlets"
import { useEmployees, usePositions, type Employee } from "@/hooks/use-employees"
import { EMPLOYMENT_STATUSES } from "@/lib/validators/employees"
import { CreateEmployeeDialog } from "./create-employee-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 10

export default function EmployeesPage() {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("employees.manage")

  const [search, setSearch] = useState("")
  const [outletFilter, setOutletFilter] = useState("all")
  const [positionFilter, setPositionFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  const { data: outlets } = useOutlets({ limit: 100 })
  const { data: positions } = usePositions()
  const { data, isLoading, isPlaceholderData } = useEmployees({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    outletId: outletFilter !== "all" ? Number(outletFilter) : undefined,
    positionId: positionFilter !== "all" ? Number(positionFilter) : undefined,
    employmentStatus: statusFilter !== "all" ? statusFilter : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const positionName = (id: number | null) => positions?.find((p) => p.id === id)?.name ?? "—"
  const outletName = (id: number) => outlets?.data.find((o) => o.id === id)?.name ?? "Loading…"

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.employeeCode}</p>
          </div>
        ),
      },
      { id: "position", header: "Position", cell: ({ row }) => positionName(row.original.positionId) },
      { id: "outlet", header: "Outlet", cell: ({ row }) => outletName(row.original.outletId) },
      {
        id: "employmentStatus",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.employmentStatus === "active" ? "secondary" : "outline"}>
            {row.original.employmentStatus}
          </Badge>
        ),
      },
      { id: "joiningDate", header: "Joined", cell: ({ row }) => row.original.joiningDate ?? "—" },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, outlets],
  )

  const table = useReactTable({ data: data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() })
  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  usePageTitle("Employees")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Employees</h1>
        {canManage && <CreateEmployeeDialog />}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search employees..."
          />
        </div>
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Filter by outlet</label>
          <Select
            items={[
              { value: "all", label: "All outlets" },
              ...(outlets?.data.map((outlet) => ({ value: String(outlet.id), label: outlet.name })) ?? []),
            ]}
            value={outletFilter}
            onValueChange={(v) => { setOutletFilter(v ?? "all"); setPage(1) }}
          >
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
          <label className="text-sm font-medium">Filter by position</label>
          <Select
            items={[
              { value: "all", label: "All positions" },
              ...(positions?.map((position) => ({ value: String(position.id), label: position.name })) ?? []),
            ]}
            value={positionFilter}
            onValueChange={(v) => { setPositionFilter(v ?? "all"); setPage(1) }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All positions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All positions</SelectItem>
              {positions?.map((position) => (
                <SelectItem key={position.id} value={String(position.id)}>
                  {position.name}
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
              {EMPLOYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <UsersIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-sm text-muted-foreground">Create an employee to get started.</p>
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/employees/${row.original.id}`)}
                >
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
