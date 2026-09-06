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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  importTemplateUrl,
  useCommitImport,
  usePreviewImport,
  useRevalidateImport,
  type ImportCommitRowInput,
  type ImportRow,
} from "@/hooks/use-data-import"
import type { DataImportDomainConfig } from "./domain-configs"

const REVALIDATE_DEBOUNCE_MS = 500
// Committed in slices rather than one request so the UI has something real to
// report progress against, and so a failure partway through only loses the
// one in-flight chunk — same rationale as the Foods importer this generalizes.
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

interface RowMeta {
  clientRowId: string
  rowNumber: number
}

export function ImportWizardDialog({ config }: { config: DataImportDomainConfig }) {
  const [open, setOpen] = useState(false)
  const [rawRows, setRawRows] = useState<Record<string, string>[] | null>(null)
  const [validated, setValidated] = useState<ImportRow[] | null>(null)
  const [rowMeta, setRowMeta] = useState<RowMeta[] | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null)
  const [commitFailed, setCommitFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // How many commit chunks have already been sent successfully — lets a
  // retry after a failed chunk resume instead of resending already-committed
  // rows (harmless either way, since commit is idempotent per clientRowId,
  // but resuming avoids the redundant round trips).
  const chunksSentRef = useRef(0)

  const previewImport = usePreviewImport(config.domain)
  const revalidateImport = useRevalidateImport(config.domain)
  const commitImport = useCommitImport(config.domain)

  const validIndexes = validated?.map((r, i) => (r.errors.length === 0 ? i : -1)).filter((i) => i >= 0) ?? []
  const invalidCount = (validated?.length ?? 0) - validIndexes.length
  const isCommitting = commitProgress !== null && !commitFailed

  function reset() {
    setRawRows(null)
    setValidated(null)
    setRowMeta(null)
    setJobId(null)
    setUploadPercent(null)
    setCommitProgress(null)
    setCommitFailed(false)
    chunksSentRef.current = 0
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  function extractRaw(row: ImportRow): Record<string, string> {
    const values: Record<string, string> = {}
    for (const column of config.columns) {
      const value = row[column.key]
      values[column.key] = value === null || value === undefined ? "" : String(value)
    }
    return values
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadPercent(0)
    try {
      const result = await previewImport.mutateAsync({ file, onUploadProgress: setUploadPercent })
      setJobId(result.jobId)
      setRawRows(result.rows.map(extractRaw))
      setValidated(result.rows)
      setRowMeta(result.rows.map((r, i) => ({ clientRowId: `row-${i}`, rowNumber: r.rowNumber })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse file")
    } finally {
      setUploadPercent(null)
    }
  }

  function scheduleRevalidate(nextRows: Record<string, string>[]) {
    if (!jobId || !rowMeta) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await revalidateImport.mutateAsync({
          jobId,
          rows: nextRows.map((values, i) => ({ rowNumber: rowMeta[i]!.rowNumber, values })),
        })
        setValidated(result.rows)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to re-check rows")
      }
    }, REVALIDATE_DEBOUNCE_MS)
  }

  function updateRow(index: number, key: string, value: string) {
    setRawRows((prev) => {
      if (!prev) return prev
      const next = prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
      scheduleRevalidate(next)
      return next
    })
  }

  async function handleConfirm() {
    if (!jobId || !rawRows || !rowMeta || validIndexes.length === 0) return
    const validChunks = chunk(validIndexes, COMMIT_CHUNK_SIZE)
    setCommitFailed(false)
    setCommitProgress({ done: Math.min(chunksSentRef.current * COMMIT_CHUNK_SIZE, validIndexes.length), total: validIndexes.length })

    let committedCount = 0
    let failedCount = 0
    try {
      for (let i = chunksSentRef.current; i < validChunks.length; i++) {
        const rows: ImportCommitRowInput[] = validChunks[i]!.map((index) => ({
          clientRowId: rowMeta[index]!.clientRowId,
          rowNumber: rowMeta[index]!.rowNumber,
          values: rawRows[index]!,
        }))
        const response = await commitImport.mutateAsync({ jobId, rows })
        committedCount += response.result.committedCount
        failedCount += response.result.failedCount
        chunksSentRef.current = i + 1
        setCommitProgress((prev) =>
          prev ? { done: Math.min(prev.done + rows.length, prev.total), total: prev.total } : prev,
        )
      }
      if (failedCount > 0) {
        toast.warning(`Imported ${committedCount}, ${failedCount} failed`)
      } else {
        toast.success(`Imported ${committedCount} ${config.label.toLowerCase()} row${committedCount === 1 ? "" : "s"}`)
      }
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed — you can retry, already-imported rows won't be duplicated")
      setCommitFailed(true)
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
      <DialogTrigger render={<Button variant="outline">Import {config.label}</Button>} />
      <DialogContent className="max-w-[90vw] sm:max-w-[70vw]">
        <DialogHeader>
          <DialogTitle>Import {config.label.toLowerCase()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 z-[100]">
          {!rawRows && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file, or{" "}
                <a href={importTemplateUrl(config.domain)} className="underline">
                  download the template
                </a>
                .
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

          {rawRows && validated && rowMeta && (
            <div className="space-y-3">
              {commitProgress && (
                <ProgressBar
                  percent={Math.round((commitProgress.done / commitProgress.total) * 100)}
                  label={
                    commitFailed
                      ? `Stopped at ${commitProgress.done}/${commitProgress.total} — click Import to retry`
                      : `Importing ${commitProgress.done}/${commitProgress.total}…`
                  }
                />
              )}
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{validIndexes.length} ready</Badge>
                {invalidCount > 0 && <Badge variant="destructive">{invalidCount} with errors</Badge>}
                {revalidateImport.isPending && (
                  <span className="text-xs text-muted-foreground">Re-checking…</span>
                )}
                <p className="ml-auto text-xs text-muted-foreground">Edit any cell to fix errors.</p>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      {config.columns.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawRows.map((row, index) => {
                      const errors = validated[index]?.errors ?? []
                      return (
                        <TableRow key={rowMeta[index]!.clientRowId}>
                          <TableCell className="text-xs text-muted-foreground">{rowMeta[index]!.rowNumber}</TableCell>
                          {config.columns.map((column) => (
                            <TableCell key={column.key}>
                              <Input
                                value={row[column.key] ?? ""}
                                onChange={(e) => updateRow(index, column.key, e.target.value)}
                                className="h-7"
                                disabled={isCommitting}
                              />
                            </TableCell>
                          ))}
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
            disabled={!validated || validIndexes.length === 0 || isCommitting || revalidateImport.isPending}
          >
            {commitFailed
              ? "Retry import"
              : commitProgress
                ? `Importing ${commitProgress.done}/${commitProgress.total}...`
                : `Import ${validIndexes.length || ""} row${validIndexes.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
