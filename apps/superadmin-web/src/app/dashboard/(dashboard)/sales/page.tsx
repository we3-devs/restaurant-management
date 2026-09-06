"use client"

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { downloadReportExport, useReport } from "@/hooks/use-reports"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"

function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function defaultRange() { const to = new Date(); return { dateFrom: isoDate(new Date(to.getTime() - 30 * 24 * 60 * 60_000)), dateTo: isoDate(to) } }
function formatSalesValue(key: string, value: unknown) {
  if (value === null || value === undefined) return "—"
  if (["unitCost", "totalCost", "paid", "notPaid"].includes(key)) return Number(value).toFixed(2)
  return String(value)
}

export default function SalesPage() {
  const { outletId } = useActiveOutlet()
  const [range, setRange] = useState(defaultRange)
  const [search, setSearch] = useState("")
  const [credited, setCredited] = useState("all")
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<string | null>(null)
  const params = { outletId, ...range, search: search || undefined, credited: credited === "all" ? undefined : credited === "credited", page, limit: 15 }
  const { data, isLoading, isPlaceholderData } = useReport("sales-items", params)
  const showSkeleton = useDelayedLoading(isLoading)

  async function exportSales(format: "csv" | "xlsx" | "pdf") {
    setExporting(format)
    try { await downloadReportExport("sales-items", params, format) } catch (error) { toast.error(error instanceof Error ? error.message : "Export failed") } finally { setExporting(null) }
  }

  usePageTitle("Sales")
  return <div className="page-shell space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sales</h1><div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm"><DateRangeFilter compact value={range} onChange={(value) => { setRange(value); setPage(1) }} /><Select value={credited} onValueChange={(value) => { setCredited(value ?? "all"); setPage(1) }}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sales</SelectItem><SelectItem value="credited">Credited</SelectItem><SelectItem value="uncredited">Non-credited</SelectItem></SelectContent></Select><Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportSales("csv")}><DownloadIcon /> Export CSV</Button></div></div>
    <div className="max-w-md"><Input className="h-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search sold items..." /></div>
    {showSkeleton ? <TableSkeleton rows={15} columns={6} /> : !data || data.data.length === 0 ? <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">No sales for this range.</div> : <div className={`overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm ${isPlaceholderData ? "opacity-60" : ""}`}><Table><TableHeader><TableRow>{data.columns.map((column) => <TableHead key={column.key}>{column.header}</TableHead>)}</TableRow></TableHeader><TableBody>{data.data.map((row, index) => <TableRow key={index}>{data.columns.map((column) => <TableCell key={column.key}>{formatSalesValue(column.key, row[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
    {data && <DataTablePagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />}
  </div>
}
