"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  useCommitFoodsImport,
  usePreviewFoodsImport,
  useRevalidateFoodsImport,
  type ImportFoodRow,
} from "@/hooks/use-foods"
import { FOOD_ITEM_TYPES, type CreateFoodInput } from "@rms/validators/foods"

/** Editable, string-only mirror of ImportFoodRow — what the row actually holds while the user is typing, sent back to /import/revalidate to get fresh errors + resolved ids. */
interface RawRow {
  rowNumber: number
  name: string
  slug: string
  sku: string
  shortDescription: string
  imageUrl: string
  foodCategory: string
  itemType: string
  departmentType: string
  foodType: string
  basePrice: string
}

function toRawRow(row: ImportFoodRow): RawRow {
  return {
    rowNumber: row.rowNumber,
    name: row.name,
    slug: row.slug,
    sku: row.sku ?? "",
    shortDescription: row.shortDescription ?? "",
    imageUrl: row.imageUrl ?? "",
    foodCategory: row.foodCategoryName ?? "",
    itemType: row.itemType,
    departmentType: row.departmentType ?? "",
    foodType: row.foodType ?? "",
    basePrice: String(row.basePrice),
  }
}

function toCreateFoodInput(row: ImportFoodRow): CreateFoodInput {
  return {
    foodCategoryId: row.foodCategoryId ?? undefined,
    name: row.name,
    slug: row.slug,
    sku: row.sku ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    itemType: row.itemType as CreateFoodInput["itemType"],
    departmentType: (row.departmentType ?? undefined) as CreateFoodInput["departmentType"],
    foodType: (row.foodType ?? undefined) as CreateFoodInput["foodType"],
    basePrice: row.basePrice,
  }
}

const REVALIDATE_DEBOUNCE_MS = 500
// Committed in slices rather than one request so the UI has something real to
// report progress against — a single request for 500 rows would just sit at
// 0% then jump to 100%.
const COMMIT_CHUNK_SIZE = 10

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function ImportFoodsDialog() {
  const [open, setOpen] = useState(false)
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null)
  const [validated, setValidated] = useState<ImportFoodRow[] | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewImport = usePreviewFoodsImport()
  const revalidateImport = useRevalidateFoodsImport()
  const commitImport = useCommitFoodsImport()

  const validRows = validated?.filter((r) => r.errors.length === 0) ?? []
  const invalidCount = (validated?.length ?? 0) - validRows.length
  const isCommitting = commitProgress !== null

  function reset() {
    setRawRows(null)
    setValidated(null)
    setUploadPercent(null)
    setCommitProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadPercent(0)
    try {
      const result = await previewImport.mutateAsync({
        file,
        onUploadProgress: setUploadPercent,
      })
      setRawRows(result.rows.map(toRawRow))
      setValidated(result.rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse file")
    } finally {
      setUploadPercent(null)
    }
  }

  function scheduleRevalidate(nextRows: RawRow[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await revalidateImport.mutateAsync(
          nextRows.map((r) => ({
            name: r.name,
            slug: r.slug,
            sku: r.sku,
            shortDescription: r.shortDescription,
            imageUrl: r.imageUrl,
            foodCategory: r.foodCategory,
            itemType: r.itemType,
            departmentType: r.departmentType,
            foodType: r.foodType,
            basePrice: r.basePrice,
          })),
        )
        setValidated(result.rows)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to re-check rows")
      }
    }, REVALIDATE_DEBOUNCE_MS)
  }

  function updateRow(index: number, patch: Partial<RawRow>) {
    setRawRows((prev) => {
      if (!prev) return prev
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
      scheduleRevalidate(next)
      return next
    })
  }

  async function handleConfirm() {
    if (validRows.length === 0) return
    const chunks = chunk(validRows, COMMIT_CHUNK_SIZE)
    setCommitProgress({ done: 0, total: validRows.length })

    let createdCount = 0
    let failedCount = 0
    try {
      for (const group of chunks) {
        const result = await commitImport.mutateAsync(group.map(toCreateFoodInput))
        createdCount += result.createdCount
        failedCount += result.failedCount
        setCommitProgress((prev) => (prev ? { done: Math.min(prev.done + group.length, prev.total), total: prev.total } : prev))
      }
      if (failedCount > 0) {
        toast.warning(`Imported ${createdCount}, ${failedCount} failed`)
      } else {
        toast.success(`Imported ${createdCount} menu item${createdCount === 1 ? "" : "s"}`)
      }
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed")
      setCommitProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline">Import</Button>} />
      <DialogContent className="max-w-[90vw] sm:max-w-[70vw]">
        <DialogHeader>
          <DialogTitle>Import menu items</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 z-[100]">
          {!rawRows && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file. 
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={previewImport.isPending}
              />
              {uploadPercent !== null && <ProgressBar percent={uploadPercent} label="Uploading…" />}
            </div>
          )}

          {rawRows && validated && (
            <div className="space-y-3">
              {isCommitting && commitProgress && (
                <ProgressBar
                  percent={Math.round((commitProgress.done / commitProgress.total) * 100)}
                  label={`Importing ${commitProgress.done}/${commitProgress.total}…`}
                />
              )}
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{validRows.length} ready</Badge>
                {invalidCount > 0 && <Badge variant="destructive">{invalidCount} with errors</Badge>}
                {revalidateImport.isPending && (
                  <span className="text-xs text-muted-foreground">Re-checking…</span>
                )}
                <p className="ml-auto text-xs text-muted-foreground">
                  Edit any cell to fix errors.
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-24">Price</TableHead>
                      <TableHead className="w-32">Type</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawRows.map((row, index) => {
                      const errors = validated[index]?.errors ?? []
                      return (
                        <TableRow key={row.rowNumber}>
                          <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                          <TableCell>
                            <Input
                              value={row.name}
                              onChange={(e) => updateRow(index, { name: e.target.value })}
                              className="h-7"
                              disabled={isCommitting}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.slug}
                              onChange={(e) => updateRow(index, { slug: e.target.value })}
                              className="h-7 font-mono text-xs"
                              disabled={isCommitting}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.sku}
                              onChange={(e) => updateRow(index, { sku: e.target.value })}
                              className="h-7"
                              disabled={isCommitting}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.basePrice}
                              onChange={(e) => updateRow(index, { basePrice: e.target.value })}
                              className="h-7"
                              disabled={isCommitting}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.itemType}
                              onValueChange={(value) => value && updateRow(index, { itemType: value })}
                              disabled={isCommitting}
                            >
                              <SelectTrigger className="h-7 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FOOD_ITEM_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {errors.length === 0 ? (
                              <Badge variant="secondary">OK</Badge>
                            ) : (
                              <span className="text-xs text-destructive">{errors.join("; ")}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {rawRows && (
            <Button variant="outline" onClick={reset} disabled={isCommitting}>
              Choose different file
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!validated || validRows.length === 0 || isCommitting || revalidateImport.isPending}
          >
            {isCommitting && commitProgress
              ? `Importing ${commitProgress.done}/${commitProgress.total}...`
              : `Import ${validRows.length || ""} item${validRows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
