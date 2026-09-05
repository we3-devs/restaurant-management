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
  return <div className="space-y-4">
    <div><h1 className="text-lg font-semibold">Sales</h1><p className="text-sm text-muted-foreground">Overall quantity and value sold for each item in the selected period.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <DateRangeFilter value={range} onChange={(value) => { setRange(value); setPage(1) }} />
      <div className="w-56 space-y-1.5"><label className="text-sm font-medium">Search item</label><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search item..." /></div>
      <div className="w-44 space-y-1.5"><label className="text-sm font-medium">Credit status</label><Select value={credited} onValueChange={(value) => { setCredited(value ?? "all"); setPage(1) }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sales</SelectItem><SelectItem value="credited">Credited items</SelectItem><SelectItem value="uncredited">Non-credited items</SelectItem></SelectContent></Select></div>
      <div className="ml-auto flex items-center gap-1.5"><Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportSales("csv")}><DownloadIcon /> CSV</Button><Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportSales("xlsx")}><DownloadIcon /> Excel</Button><Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportSales("pdf")}><DownloadIcon /> PDF</Button></div>
    </div>
    {showSkeleton ? <TableSkeleton rows={15} columns={6} /> : !data || data.data.length === 0 ? <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">No sales for this range.</div> : <div className={isPlaceholderData ? "opacity-60" : undefined}><Table><TableHeader><TableRow>{data.columns.map((column) => <TableHead key={column.key}>{column.header}</TableHead>)}</TableRow></TableHeader><TableBody>{data.data.map((row, index) => <TableRow key={index}>{data.columns.map((column) => <TableCell key={column.key}>{formatSalesValue(column.key, row[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
    {data && <DataTablePagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />}
  </div>
}
