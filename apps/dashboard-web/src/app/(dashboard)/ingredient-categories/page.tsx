"use client"

import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIngredientCategories, type IngredientCategory } from "@/hooks/use-ingredient-categories"
import { CreateIngredientCategoryDialog } from "./create-ingredient-category-dialog"

export default function IngredientCategoriesPage() {
  const { data, isLoading } = useIngredientCategories({ limit: 100 })
  const showSkeleton = useDelayedLoading(isLoading)

  const nameById = new Map((data?.data ?? []).map((category) => [category.id, category.name]))

  const columns: ColumnDef<IngredientCategory>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
    {
      id: "parent",
      header: "Parent",
      cell: ({ row }) =>
        row.original.parentId ? (nameById.get(row.original.parentId) ?? "Loading…") : "—",
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
        <h1 className="text-lg font-semibold">Ingredient Categories</h1>
        <CreateIngredientCategoryDialog />
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
                    <Link href={`/ingredient-categories/${row.original.id}`} className="block">
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
