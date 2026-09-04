"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontalIcon } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { useDeleteIngredient, useIngredients, type Ingredient } from "@/hooks/use-ingredients"
import { CreateIngredientDialog } from "./create-ingredient-dialog"
import { usePageTitle } from "@rms/ui/use-page-title"

export default function IngredientsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null)
  const { data: categories } = useIngredientCategories({ limit: 100 })
  const { data, isLoading } = useIngredients({
    limit: 100,
    ingredientCategoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)
  const deleteIngredient = useDeleteIngredient()

  const columns: ColumnDef<Ingredient>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => (
        <span>
          {row.original.category.name}{" "}
          <span className="text-muted-foreground">({row.original.category.type})</span>
        </span>
      ),
    },
    {
      id: "flags",
      header: "",
      cell: ({ row }) => (!row.original.isActive ? <Badge variant="destructive">inactive</Badge> : null),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteIngredient.mutateAsync(deleteTarget.id)
      toast.success(`Ingredient "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete ingredient")
    }
  }

  usePageTitle("Ingredients")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ingredients</h1>
        <CreateIngredientDialog />
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Filter by category</label>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.data.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                {row.getVisibleCells().map((cell) =>
                  cell.column.id === "actions" ? (
                    <TableCell key={cell.id} onClick={(event) => event.stopPropagation()}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ) : (
                    <TableCell key={cell.id}>
                      <Link href={`/ingredients/${row.original.id}`} className="block">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Link>
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ingredient &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This soft-deletes the ingredient. This cannot be undone from the UI.</AlertDialogDescription>
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
