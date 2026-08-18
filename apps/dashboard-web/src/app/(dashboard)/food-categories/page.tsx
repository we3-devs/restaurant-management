"use client"

import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFoodCategories, type FoodCategory } from "@/hooks/use-food-categories"
import { CreateFoodCategoryDialog } from "./create-food-category-dialog"

export default function FoodCategoriesPage() {
  const { data, isLoading } = useFoodCategories({ limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  const nameById = new Map((data?.data ?? []).map((category) => [category.id, category.name]))

  const columns: ColumnDef<FoodCategory>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "parent",
      header: "Parent",
      cell: ({ row }) =>
        row.original.parentId ? (nameById.get(row.original.parentId) ?? `#${row.original.parentId}`) : "—",
    },
    {
      id: "flags",
      header: "",
      cell: ({ row }) => (!row.original.isActive ? <Badge variant="destructive">inactive</Badge> : null),
    },
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Food Categories</h1>
        <CreateFoodCategoryDialog />
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
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
                  <TableCell key={cell.id}>
                    <Link href={`/food-categories/${row.original.id}`} className="block">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
