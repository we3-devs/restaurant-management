"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChefHatIcon, DownloadIcon, EraserIcon, PackagePlusIcon, Trash2Icon } from "lucide-react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from "@tanstack/react-table"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useFoodCategories } from "@/hooks/use-food-categories"
import { useAnalyticsProducts } from "@/hooks/use-analytics"
import { useIngredientCategories } from "@/hooks/use-ingredient-categories"
import { useUnits } from "@/hooks/use-units"
import {
  useBulkDeleteFoods,
  useBulkImportFoodsAsIngredients,
  useBulkUpdateFoodsDepartment,
  useFoods,
  useResetFoods,
  type Food,
} from "@/hooks/use-foods"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { OUTLET_DEPARTMENT_TYPES } from "@/lib/validators/foods"
import { isTrackedIngredientType } from "@/lib/validators/ingredient-categories"
import { CreateFoodDialog } from "./create-food-dialog"
import { FoodsBackgroundPrefetch } from "./foods-background-prefetch"
import { usePageTitle } from "@rms/ui/use-page-title"

type FoodRow = Food & { categoryName: string; popularity: number; periodRevenue: number }

const SELECT_COLUMN_ID = "select"

function buildColumns(selectable: boolean): ColumnDef<FoodRow>[] {
  const dataColumns: ColumnDef<FoodRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "categoryName", header: "Category" },
    { accessorKey: "skuSegment", header: "SKU" },
    { accessorKey: "popularity", header: "Sold", cell: ({ row }) => row.original.popularity.toLocaleString() },
    { accessorKey: "periodRevenue", header: "Revenue", cell: ({ row }) => `NPR ${Math.round(row.original.periodRevenue).toLocaleString()}` },
    {
      id: "flags",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.departmentType ? <Badge variant="outline">prep: {row.original.departmentType}</Badge> : <Badge variant="secondary">ready-made</Badge>}
          {row.original.hasVariants && <Badge variant="secondary">variants</Badge>}
          {row.original.hasAddons && <Badge variant="secondary">addons</Badge>}
          {!row.original.isActive && <Badge variant="destructive">inactive</Badge>}
        </div>
      ),
    },
  ]
  if (!selectable) return dataColumns
  return [
    {
      id: SELECT_COLUMN_ID,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          aria-label="Select row"
        />
      ),
    },
    ...dataColumns,
  ]
}

export default function FoodsPage() {
  return <FoodsList readOnly={false} />
}

export function FoodsList({ readOnly }: { readOnly: boolean }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all")
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
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
    }).filter((food) => availabilityFilter === "all" || (availabilityFilter === "available" ? food.isActive : !food.isActive))
  }, [categories, data, performance, availabilityFilter])
  const showSkeleton = useDelayedLoading(isLoading || performanceLoading)
  const columns = useMemo(() => buildColumns(!readOnly), [readOnly])
  const bulkDeleteFoods = useBulkDeleteFoods()
  const bulkUpdateDepartment = useBulkUpdateFoodsDepartment()
  const [bulkDepartment, setBulkDepartment] = useState<string>("none")
  const [prepPopoverOpen, setPrepPopoverOpen] = useState(false)
  const { outletId: activeOutletId } = useActiveOutlet()
  const { data: ingredientCategories } = useIngredientCategories({ limit: 100 })
  // This import exists to make foods stock-trackable, and only beverage /
  // packaging / consumable categories carry warehouse stock — landing a food
  // in a raw_material or ready_product category would create an ingredient
  // that no stock document will ever accept.
  const stockTrackedCategories = useMemo(
    () => (ingredientCategories?.data ?? []).filter((category) => isTrackedIngredientType(category.type)),
    [ingredientCategories],
  )
  const { data: units } = useUnits({ limit: 100 })
  const bulkImportAsIngredients = useBulkImportFoodsAsIngredients()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importCategoryId, setImportCategoryId] = useState<string>("")
  const [importUnitId, setImportUnitId] = useState<string>("")
  const resetFoods = useResetFoods()
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState("")

  function handleExport() {
    const header = ["Name", "Category", "SKU", "Sold", "Revenue", "Availability"]
    const values = rows.map((food) => [food.name, food.categoryName, food.skuSegment ?? "", food.popularity, food.periodRevenue, food.isActive ? "Available" : "Unavailable"])
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
    getRowId: (row) => String(row.id),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  })

  const selectedIds = Object.keys(rowSelection).map(Number)

  async function handleBulkDelete() {
    try {
      const result = await bulkDeleteFoods.mutateAsync(selectedIds)
      toast.success(`${result.deleted} food${result.deleted === 1 ? "" : "s"} deleted`)
      setRowSelection({})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete foods")
    }
  }

  async function handleBulkDepartment() {
    try {
      const departmentType = bulkDepartment === "none" ? null : bulkDepartment
      const result = await bulkUpdateDepartment.mutateAsync({ ids: selectedIds, departmentType })
      toast.success(
        departmentType
          ? `${result.updated} food${result.updated === 1 ? "" : "s"} marked as needing prep`
          : `${result.updated} food${result.updated === 1 ? "" : "s"} marked as ready-made`,
      )
      setRowSelection({})
      setPrepPopoverOpen(false)
      setBulkDepartment("none")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update foods")
    }
  }

  async function handleBulkImportAsIngredients() {
    if (!activeOutletId || !importCategoryId || !importUnitId) return
    try {
      const result = await bulkImportAsIngredients.mutateAsync({
        foodIds: selectedIds,
        outletId: activeOutletId,
        ingredientCategoryId: Number(importCategoryId),
        baseUnitId: Number(importUnitId),
      })
      if (result.created > 0) toast.success(`Imported ${result.created} food${result.created === 1 ? "" : "s"} into inventory`)
      if (result.skipped > 0) toast.info(`Skipped ${result.skipped} already-linked food${result.skipped === 1 ? "" : "s"}`)
      if (result.errors.length > 0) toast.error(`${result.errors.length} failed: ${result.errors.join("; ")}`)
      setRowSelection({})
      setImportDialogOpen(false)
      setImportCategoryId("")
      setImportUnitId("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import foods into inventory")
    }
  }

  async function handleReset() {
    try {
      const result = await resetFoods.mutateAsync()
      toast.success(
        `Reset: ${result.deletedFoods} food${result.deletedFoods === 1 ? "" : "s"}, ${result.deletedCategories} categor${result.deletedCategories === 1 ? "y" : "ies"}, ${result.deletedFoodVariants} food item${result.deletedFoodVariants === 1 ? "" : "s"} soft-deleted`,
      )
      setRowSelection({})
      setResetDialogOpen(false)
      setResetConfirmText("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset foods")
    }
  }

  usePageTitle("Foods")

  return (
    <div className="page-shell space-y-7">
      <FoodsBackgroundPrefetch />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{readOnly ? "Foods Overview" : "Manage Foods"}</h1></div>
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}><SelectTrigger className="h-9 w-40 rounded-xl text-xs"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories?.data.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select>
          <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value ?? "all")}><SelectTrigger className="h-9 w-32 rounded-xl text-xs"><SelectValue placeholder="Availability" /></SelectTrigger><SelectContent><SelectItem value="all">Availability</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="unavailable">Unavailable</SelectItem></SelectContent></Select>
          <Button variant="outline" size="sm" disabled={isLoading || rows.length === 0} onClick={handleExport}><DownloadIcon /> Export CSV</Button>
          {!readOnly && selectedIds.length > 0 && (
            <Popover open={prepPopoverOpen} onOpenChange={setPrepPopoverOpen}>
              <PopoverTrigger render={<Button variant="outline" size="sm"><ChefHatIcon /> Needs prep ({selectedIds.length})</Button>} />
              <PopoverContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Set which department prepares the selected foods, or clear it to mark them ready-made (no kitchen prep).</p>
                <Select value={bulkDepartment} onValueChange={(value) => setBulkDepartment(value ?? "none")}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="None — ready-made" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — ready-made</SelectItem>
                    {OUTLET_DEPARTMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full" onClick={handleBulkDepartment} disabled={bulkUpdateDepartment.isPending}>
                  Apply to {selectedIds.length} food{selectedIds.length === 1 ? "" : "s"}
                </Button>
              </PopoverContent>
            </Popover>
          )}
          {!readOnly && selectedIds.length > 0 && (
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm"><PackagePlusIcon /> Import to inventory ({selectedIds.length})</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import {selectedIds.length} food{selectedIds.length === 1 ? "" : "s"} into inventory</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Creates a stock-tracked ingredient for each selected food (already-linked foods are skipped) in the active outlet.</p>
                  <Select value={importCategoryId} onValueChange={(value) => setImportCategoryId(value ?? "")}>
                    <SelectTrigger className="w-full" disabled={stockTrackedCategories.length === 0}>
                      <SelectValue placeholder={stockTrackedCategories.length === 0 ? "No stock-tracked categories" : "Ingredient category"} />
                    </SelectTrigger>
                    <SelectContent>{stockTrackedCategories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {stockTrackedCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Create an ingredient category of type beverage, packaging or consumable first — those are the types that carry warehouse stock.
                    </p>
                  )}
                  <Select value={importUnitId} onValueChange={(value) => setImportUnitId(value ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Base unit" /></SelectTrigger>
                    <SelectContent>{units?.data.map((unit) => <SelectItem key={unit.id} value={String(unit.id)}>{unit.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleBulkImportAsIngredients}
                    disabled={!activeOutletId || !importCategoryId || !importUnitId || bulkImportAsIngredients.isPending}
                  >
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {!readOnly && selectedIds.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" size="sm"><Trash2Icon /> Delete selected ({selectedIds.length})</Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.length} food{selectedIds.length === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>This soft-deletes the selected foods. This cannot be undone from the UI.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!readOnly && (
            <AlertDialog
              open={resetDialogOpen}
              onOpenChange={(open) => {
                setResetDialogOpen(open)
                if (!open) setResetConfirmText("")
              }}
            >
              <AlertDialogTrigger render={<Button variant="destructive" size="sm"><EraserIcon /> Reset Food</Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all food data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This soft-deletes every food category, food, and food item for this tenant — the whole menu. Past
                    orders and analytics keep working, but nothing will show up in the menu or POS until you rebuild
                    it. This cannot be undone from the UI.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-1.5">
                  <label htmlFor="reset-food-confirm" className="text-xs text-muted-foreground">
                    Type <span className="font-mono font-semibold">RESET</span> to confirm
                  </label>
                  <Input
                    id="reset-food-confirm"
                    value={resetConfirmText}
                    onChange={(event) => setResetConfirmText(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={resetConfirmText !== "RESET" || resetFoods.isPending}
                    onClick={handleReset}
                  >
                    {resetFoods.isPending ? "Resetting…" : "Reset everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {readOnly ? <Button variant="outline" size="sm" render={<Link href="/dashboard/menu/foods" />}>Manage Foods</Button> : <CreateFoodDialog />}
        </div>
      </div>
      {showSkeleton ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
        <div className="overflow-hidden rounded-md border border-border"><Table>
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
                  cell.column.id === SELECT_COLUMN_ID ? (
                    <TableCell key={cell.id} onClick={(event) => event.stopPropagation()}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ) : (
                    <TableCell key={cell.id}>
                      <Link href={`/dashboard/menu/foods/${row.original.id}`} className="block">{flexRender(cell.column.columnDef.cell, cell.getContext())}</Link>
                    </TableCell>
                  )
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      )}
    </div>
  )
}
