"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useFoodCategories } from "@/hooks/use-food-categories"
import { useFoods, type Food } from "@/hooks/use-foods"
import { CreateFoodDialog } from "./create-food-dialog"
import { FoodsBackgroundPrefetch } from "./foods-background-prefetch"
import { usePageTitle } from "@rms/ui/use-page-title"

const columns: ColumnDef<Food>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "sku", header: "SKU" },
  { accessorKey: "basePrice", header: "Base price" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.hasVariants && <Badge variant="secondary">variants</Badge>}
        {row.original.hasAddons && <Badge variant="secondary">addons</Badge>}
        {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
      </div>
    ),
  },
]

export default function FoodsPage() {
  return <FoodsList readOnly={false} />
}

export function FoodsList({ readOnly }: { readOnly: boolean }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const { data: categories } = useFoodCategories({ limit: 100 })
  const { data, isLoading } = useFoods({
    limit: 100,
    foodCategoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
  })
  const showSkeleton = useDelayedLoading(isLoading)

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Foods")

  return (
    <div className="page-shell space-y-7">
      <FoodsBackgroundPrefetch />
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{readOnly ? "Foods Overview" : "Manage Foods"}</h1>{readOnly && <p className="mt-1 text-sm text-muted-foreground">Menu performance and availability at a glance.</p>}</div>
        {readOnly ? <Button variant="outline" render={<Link href="/dashboard/foods" />}>Manage Foods</Button> : <CreateFoodDialog />}
      </div>

      <div className="w-64 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-sm space-y-1.5">
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
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm"><Table>
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
                    {readOnly ? flexRender(cell.column.columnDef.cell, cell.getContext()) : <Link href={`/dashboard/foods/${row.original.id}`} className="block">{flexRender(cell.column.columnDef.cell, cell.getContext())}</Link>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      )}
    </div>
  )
}
