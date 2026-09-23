"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { downloadReportExport, useReport, type ReportType } from "@/hooks/use-reports"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { REPORT_GROUPS, REPORT_ROW_LINK, SEARCH_PLACEHOLDER } from "../report-catalog"

const PAGE_SIZE = 15
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string" && ISO_DATETIME.test(value)) {
    return new Date(value).toLocaleString()
  }
  return String(value)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return { dateFrom: isoDate(from), dateTo: isoDate(to) }
}

export function ReportView({ slug, label, description }: { slug: ReportType; label: string; description: string }) {
  const router = useRouter()
  // Outlet is already a global concept (see the header switcher) — reports
  // just follow whatever's currently active there instead of asking again.
  const { outletId } = useActiveOutlet()
  const { permissions } = useCurrentUser()
  const [range, setRange] = useState(defaultRange)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<string | null>(null)
  const [creditedFilter, setCreditedFilter] = useState("all")

  const params = { outletId, ...range, search: search || undefined, credited: slug === "sales-items" && creditedFilter !== "all" ? creditedFilter === "credited" : undefined, page, limit: PAGE_SIZE }
  const { data, isLoading, isPlaceholderData } = useReport(slug, params)
  const showSkeleton = useDelayedLoading(isLoading)
  const rowLink = REPORT_ROW_LINK[slug]

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setExporting(format)
    try {
      await downloadReportExport(slug, params, format)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }

  usePageTitle(`${label} report`)

  return (
    <div className="page-shell space-y-7">
      <div className="space-y-3">
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> All reports
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{label}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
            <Select value={slug} onValueChange={(value) => { if (value) router.push(`/dashboard/reports/${value}`) }}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_GROUPS.filter((group) => !group.permission || permissions.includes(group.permission)).map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.group}</SelectLabel>
                    {group.reports.map((report) => <SelectItem key={report.slug} value={report.slug}>{report.label}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter compact showQuickRanges value={range} onChange={(v) => { setRange(v); setPage(1) }} />
            {slug === "sales-items" && (
              <Select value={creditedFilter} onValueChange={(value) => { setCreditedFilter(value ?? "all"); setPage(1) }}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sales</SelectItem>
                  <SelectItem value="credited">Credited</SelectItem>
                  <SelectItem value="uncredited">Non-credited</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("csv")}><DownloadIcon /> {exporting === "csv" ? "Exporting..." : "CSV"}</Button>
            <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("xlsx")}><DownloadIcon /> {exporting === "xlsx" ? "Exporting..." : "Excel"}</Button>
            <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("pdf")}><DownloadIcon /> {exporting === "pdf" ? "Exporting..." : "PDF"}</Button>
          </div>
        </div>
      </div>

      <div className="mt-3 max-w-md">
        <Input className="h-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={SEARCH_PLACEHOLDER[slug]} />
      </div>

      {showSkeleton ? (
        <TableSkeleton rows={PAGE_SIZE} columns={6} />
      ) : !data || data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No data for this range</p>
          <p className="text-sm text-muted-foreground">Try widening the date range or filters.</p>
        </div>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                {data.columns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row, i) => (
                <TableRow key={i}>
                  {data.columns.map((col) => {
                    const href = rowLink?.column === col.key ? rowLink.href(row) : null
                    return (
                      <TableCell key={col.key}>
                        {href ? (
                          <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
                            {formatCell(row[col.key])}
                          </Link>
                        ) : (
                          formatCell(row[col.key])
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <DataTablePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
