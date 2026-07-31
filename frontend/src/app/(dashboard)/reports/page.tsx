"use client"

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useOutlets } from "@/hooks/use-outlets"
import { downloadReportExport, useReport, type ReportType } from "@/hooks/use-reports"

const REPORT_TABS: { value: ReportType; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "orders", label: "Orders" },
  { value: "inventory", label: "Inventory" },
  { value: "stock-movements", label: "Stock Movements" },
  { value: "ingredient-consumption", label: "Ingredient Consumption" },
  { value: "wastage", label: "Wastage" },
  { value: "kitchen-performance", label: "Kitchen Performance" },
  { value: "reservations", label: "Reservations" },
  { value: "customers", label: "Customers" },
  { value: "payments", label: "Payments" },
  { value: "suppliers", label: "Suppliers" },
  { value: "purchase-orders", label: "Purchase Orders" },
  { value: "goods-receiving", label: "Goods Receiving" },
  { value: "purchase-returns", label: "Purchase Returns" },
  { value: "supplier-payments", label: "Supplier Payments" },
  { value: "employees", label: "Employees" },
  { value: "attendance", label: "Attendance" },
  { value: "shifts", label: "Shifts" },
  { value: "staff-performance", label: "Staff Performance" },
  { value: "payroll-export", label: "Payroll Export" },
]

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

export default function ReportsPage() {
  const { data: outlets } = useOutlets({ limit: 100 })
  const [reportType, setReportType] = useState<ReportType>("sales")
  const [outletId, setOutletId] = useState<number | null>(null)
  const [range, setRange] = useState(defaultRange)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<string | null>(null)

  const params = { outletId, ...range, search: search || undefined, page, limit: PAGE_SIZE }
  const { data, isLoading, isPlaceholderData } = useReport(reportType, params)

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setExporting(format)
    try {
      await downloadReportExport(reportType, params, format)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Reports</h1>

      <Tabs
        value={reportType}
        onValueChange={(v) => {
          if (v) {
            setReportType(v as ReportType)
            setPage(1)
          }
        }}
      >
        <TabsList className="flex-wrap">
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48 space-y-1.5">
          <label className="text-sm font-medium">Outlet</label>
          <Select
            value={outletId ? String(outletId) : "all"}
            onValueChange={(v) => {
              setOutletId(v && v !== "all" ? Number(v) : null)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All outlets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {outlets?.data.map((outlet) => (
                <SelectItem key={outlet.id} value={String(outlet.id)}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter
          value={range}
          onChange={(v) => {
            setRange(v)
            setPage(1)
          }}
        />
        <div className="w-56 space-y-1.5">
          <label className="text-sm font-medium">Search</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search..."
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("csv")}>
            <DownloadIcon /> {exporting === "csv" ? "Exporting..." : "CSV"}
          </Button>
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("xlsx")}>
            <DownloadIcon /> {exporting === "xlsx" ? "Exporting..." : "Excel"}
          </Button>
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport("pdf")}>
            <DownloadIcon /> {exporting === "pdf" ? "Exporting..." : "PDF"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
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
                  {data.columns.map((col) => (
                    <TableCell key={col.key}>{formatCell(row[col.key])}</TableCell>
                  ))}
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
