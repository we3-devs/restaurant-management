"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DownloadIcon } from "lucide-react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useFoodCategories } from "@/hooks/use-food-categories"
import { useAnalyticsProducts } from "@/hooks/use-analytics"
import { useFoods, type Food } from "@/hooks/use-foods"
import { CreateFoodDialog } from "./create-food-dialog"
import { FoodsBackgroundPrefetch } from "./foods-background-prefetch"
import { usePageTitle } from "@rms/ui/use-page-title"

type FoodRow = Food & { categoryName: string; popularity: number; periodRevenue: number }
const columns: ColumnDef<FoodRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "categoryName", header: "Category" },
  { accessorKey: "foodType", header: "Food type", cell: ({ row }) => <Badge variant="secondary">{row.original.foodType ?? "—"}</Badge> },
  { accessorKey: "sku", header: "SKU" },
  { accessorKey: "basePrice", header: "Base price", cell: ({ row }) => `NPR ${row.original.basePrice.toLocaleString()}` },
  { accessorKey: "popularity", header: "Sold", cell: ({ row }) => row.original.popularity.toLocaleString() },
  { accessorKey: "periodRevenue", header: "Revenue", cell: ({ row }) => `NPR ${Math.round(row.original.periodRevenue).toLocaleString()}` },
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
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>("all")
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all")
  const { data: categories } = useFoodCategories({ limit: 100 })
  const { data, isLoading } = useFoods({
    limit: 100,
    foodCategoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
  })
  const { data: performance, isLoading: performanceLoading } = useAnalyticsProducts({ dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) })
  const rows = useMemo<FoodRow[]>(() => {
    const categoryById = new Map((categories?.data ?? []).map((category) => [category.id, category.name]))
    const performanceByFood = new Map((performance?.foods ?? []).map((food) => [food.foodId, food]))
    return (data?.data ?? []).map((food) => {
      const result = performanceByFood.get(food.id)
      return { ...food, categoryName: categoryById.get(food.foodCategoryId ?? 0) ?? "Uncategorized", popularity: result?.quantity ?? 0, periodRevenue: result?.revenue ?? 0 }
    }).filter((food) => (foodTypeFilter === "all" || food.foodType === foodTypeFilter) && (availabilityFilter === "all" || (availabilityFilter === "available" ? food.isActive : !food.isActive)))
  }, [categories, data, performance, foodTypeFilter, availabilityFilter])
  const showSkeleton = useDelayedLoading(isLoading || performanceLoading)

  function handleExport() {
    const header = ["Name", "Category", "Food type", "SKU", "Base price", "Sold", "Revenue", "Availability"]
    const values = rows.map((food) => [food.name, food.categoryName, food.foodType ?? "", food.sku ?? "", food.basePrice, food.popularity, food.periodRevenue, food.isActive ? "Available" : "Unavailable"])
    const csv = [header, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "foods-overview.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  usePageTitle("Foods")

  return (
    <div className="page-shell space-y-7">
      <FoodsBackgroundPrefetch />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{readOnly ? "Foods Overview" : "Manage Foods"}</h1></div>
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}><SelectTrigger className="h-9 w-40 rounded-xl text-xs"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories?.data.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select>
          <Select value={foodTypeFilter} onValueChange={(value) => setFoodTypeFilter(value ?? "all")}><SelectTrigger className="h-9 w-32 rounded-xl text-xs"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="veg">Vegetarian</SelectItem><SelectItem value="non_veg">Non-veg</SelectItem><SelectItem value="egg">Egg</SelectItem><SelectItem value="vegan">Vegan</SelectItem></SelectContent></Select>
          <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value ?? "all")}><SelectTrigger className="h-9 w-32 rounded-xl text-xs"><SelectValue placeholder="Availability" /></SelectTrigger><SelectContent><SelectItem value="all">Availability</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="unavailable">Unavailable</SelectItem></SelectContent></Select>
          <Button variant="outline" size="sm" disabled={isLoading || rows.length === 0} onClick={handleExport}><DownloadIcon /> Export CSV</Button>
          {readOnly ? <Button variant="outline" size="sm" render={<Link href="/dashboard/foods" />}>Manage Foods</Button> : <CreateFoodDialog />}
        </div>
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
                    <Link href={`/dashboard/foods/${row.original.id}`} className="block">{flexRender(cell.column.columnDef.cell, cell.getContext())}</Link>
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
