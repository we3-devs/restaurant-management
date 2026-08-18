"use client"

import { useState } from "react"
import Link from "next/link"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFoodVariants, type FoodVariant } from "@/hooks/use-food-variants"
import { useFoods } from "@/hooks/use-foods"
import { useVariantList, type VariantListValue } from "@/hooks/use-variant-lists"
import { CreateFoodVariantDialog } from "./create-food-variant-dialog"

/**
 * Built as a function so the variant / sub-variant columns can resolve ids
 * against the global lists — a food item stores ids, and the pairing is the
 * thing worth seeing at a glance.
 */
const buildColumns = (
  variantName: (id: number | null) => string,
  subVariantName: (id: number | null) => string,
): ColumnDef<FoodVariant>[] => [
  { accessorKey: "name", header: "Name" },
  {
    id: "variant",
    header: "Variant",
    cell: ({ row }) => variantName(row.original.variantId),
  },
  {
    id: "subVariant",
    header: "Sub-variant",
    cell: ({ row }) => subVariantName(row.original.subVariantId),
  },
  { accessorKey: "sku", header: "SKU" },
  { accessorKey: "price", header: "Price" },
  {
    id: "flags",
    header: "",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.isDefault && <Badge variant="secondary">default</Badge>}
        {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
      </div>
    ),
  },
]

export default function FoodVariantsPage() {
  const [foodFilter, setFoodFilter] = useState<string>("all")
  const { data: foods } = useFoods({ limit: 100 })
  const { data, isLoading } = useFoodVariants({
    limit: 100,
    foodId: foodFilter !== "all" ? Number(foodFilter) : undefined,
  })

  const showSkeleton = useDelayedLoading(isLoading)

  const { data: variantList } = useVariantList("variants")
  const { data: subVariantList } = useVariantList("sub-variants")
  const lookup = (rows: VariantListValue[] | undefined) => (id: number | null) =>
    id === null ? "—" : (rows?.find((r) => r.id === id)?.name ?? `#${id}`)

  const table = useReactTable({
    data: data?.data ?? [],
    columns: buildColumns(lookup(variantList), lookup(subVariantList)),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Food Items</h1>
        <CreateFoodVariantDialog />
      </div>

      <div className="w-64 space-y-1.5">
        <label className="text-sm font-medium">Filter by food</label>
        <Select value={foodFilter} onValueChange={(value) => setFoodFilter(value ?? "all")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All foods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All foods</SelectItem>
            {foods?.data.map((food) => (
              <SelectItem key={food.id} value={String(food.id)}>
                {food.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={6} columns={6} />
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
                    <Link href={`/food-variants/${row.original.id}`} className="block">
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
