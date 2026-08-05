"use client"

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadReportExport, useReport, type ReportType } from "@/hooks/use-reports"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"

/** Same taxonomy as the sidebar (see nav-items.ts) — Sales/Ops, Inventory, Purchasing, Staff, Loyalty, System — so the dropdown groups reports where you'd expect to find each one instead of a flat 27-item dump. */
const REPORT_TYPE_GROUPS: { group: string; tabs: { value: ReportType; label: string }[] }[] = [
  {
    group: "Sales & Service",
    tabs: [
      { value: "sales", label: "Sales" },
      { value: "orders", label: "Orders" },
      { value: "payments", label: "Payments" },
      { value: "kitchen-performance", label: "Kitchen Performance" },
      { value: "reservations", label: "Reservations" },
      { value: "customers", label: "Customers" },
    ],
  },
  {
    group: "Inventory",
    tabs: [
      { value: "inventory", label: "Inventory" },
      { value: "stock-movements", label: "Stock Movements" },
      { value: "ingredient-consumption", label: "Ingredient Consumption" },
      { value: "wastage", label: "Wastage" },
    ],
  },
  {
    group: "Purchasing",
    tabs: [
      { value: "suppliers", label: "Suppliers" },
      { value: "purchase-orders", label: "Purchase Orders" },
      { value: "goods-receiving", label: "Goods Receiving" },
      { value: "purchase-returns", label: "Purchase Returns" },
      { value: "supplier-payments", label: "Supplier Payments" },
    ],
  },
  {
    group: "Staff",
    tabs: [
      { value: "employees", label: "Employees" },
      { value: "attendance", label: "Attendance" },
      { value: "shifts", label: "Shifts" },
      { value: "staff-performance", label: "Staff Performance" },
      { value: "payroll-export", label: "Payroll Export" },
    ],
  },
  {
    group: "Loyalty",
    tabs: [
      { value: "loyalty-top-customers", label: "Top Customers" },
      { value: "loyalty-points-earned", label: "Points Earned" },
      { value: "loyalty-points-redeemed", label: "Points Redeemed" },
      { value: "loyalty-outstanding", label: "Outstanding" },
      { value: "loyalty-transactions", label: "Transactions" },
    ],
  },
  {
    group: "System",
    tabs: [
      { value: "settings-changes", label: "Settings Changes" },
      { value: "audit-logs", label: "Audit Logs" },
    ],
  },
]

const PAGE_SIZE = 15
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/

/** What each report's `search` param actually filters by — shown as the search box placeholder so the field isn't a mystery. */
const SEARCH_PLACEHOLDER: Record<ReportType, string> = {
  sales: "Search order #...",
  orders: "Search order #...",
  inventory: "Search ingredient...",
  "stock-movements": "Search document #...",
  "ingredient-consumption": "Search ingredient...",
  wastage: "Search ingredient...",
  "kitchen-performance": "Search order #...",
  reservations: "Search customer...",
  customers: "Search customer...",
  payments: "Search order #...",
  suppliers: "Search company...",
  "purchase-orders": "Search PO #...",
  "goods-receiving": "Search GRN #...",
  "purchase-returns": "Search return #...",
  "supplier-payments": "Search payment #...",
  employees: "Search employee...",
  attendance: "Search employee...",
  shifts: "Search shift...",
  "staff-performance": "Search employee...",
  "payroll-export": "Search employee...",
  "settings-changes": "Search category...",
  "audit-logs": "Search entity type/id...",
  "loyalty-top-customers": "Search customer...",
  "loyalty-points-earned": "Search customer...",
  "loyalty-points-redeemed": "Search customer...",
  "loyalty-outstanding": "Search customer...",
  "loyalty-transactions": "Search customer...",
}

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
  // Outlet is already a global concept (see the header switcher) — reports
  // just follow whatever's currently active there instead of asking again.
  const { outletId } = useActiveOutlet()
  const [reportType, setReportType] = useState<ReportType>("sales")
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 space-y-1.5">
          <label className="text-sm font-medium">Report</label>
          <Select
            value={reportType}
            onValueChange={(v) => {
              if (!v) return
              setReportType(v as ReportType)
              setPage(1)
              // Each report searches a different field (order #, ingredient,
              // employee...) — a term left over from the previous report
              // would silently filter the new one down to nothing.
              setSearch("")
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPE_GROUPS.map((group) => (
                <SelectGroup key={group.group}>
                  <SelectLabel>{group.group}</SelectLabel>
                  {group.tabs.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>
                      {tab.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
            placeholder={SEARCH_PLACEHOLDER[reportType]}
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
