"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, SearchIcon, ShieldIcon } from "lucide-react"
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
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { DataTablePagination } from "@/components/data-table-pagination"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useDeleteRole, useRoles, type Role } from "@/hooks/use-roles"
import { CreateRoleDialog } from "./create-role-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

const PAGE_SIZE = 10

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function RolesPage() {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const canManage = isSuperadmin || permissions.includes("roles.manage")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>([])
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isPlaceholderData } = useRoles({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const deleteRole = useDeleteRole()

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        ),
      },
      { accessorKey: "rank", header: "Rank" },
      {
        id: "flags",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.isSystem && <Badge variant="secondary">system</Badge>}
            {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/roles/${row.original.id}`)}>
                  View details
                </DropdownMenuItem>
                {canManage && !row.original.isSystem && (
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row.original)}>
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [router, canManage],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteRole.mutateAsync(deleteTarget.id)
      toast.success(`Role "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role")
    }
  }

  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  usePageTitle("Roles")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Roles</h1>
        {canManage && <CreateRoleDialog />}
      </div>

      <div className="relative w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or slug..."
          className="pl-8"
        />
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={columns.length} />
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <ShieldIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No roles found</p>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ? "Try a different search." : "Create your first role to get started."}
          </p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDirection = header.column.getIsSorted()
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 select-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDirection === "asc" && <ArrowUpIcon className="size-3.5" />}
                            {sortDirection === "desc" && <ArrowDownIcon className="size-3.5" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/roles/${row.original.id}`)}
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

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes it from every user currently assigned it. This cannot be undone.
            </AlertDialogDescription>
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
  )
}
