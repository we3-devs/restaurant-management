"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BanknoteIcon, CircleDollarSignIcon, ClipboardListIcon, PackageIcon, PlusIcon, UsersIcon } from "lucide-react"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { useDashboardBreakdown, useDashboardCharts, useDashboardStats } from "@/hooks/use-dashboard"
import { useAnalyticsCustomers, useAnalyticsDashboard } from "@/hooks/use-analytics"
import { useOrders } from "@/hooks/use-orders"
import { useReport } from "@/hooks/use-reports"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"

const iso = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
const initialRange = (): DateRange => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { dateFrom: iso(from), dateTo: iso(to) }
}
const money = (value: number) => "NPR " + Math.round(value).toLocaleString()
function orderRange(range: DateRange) {
  const from = new Date(`${range.dateFrom}T00:00:00`)
  const to = new Date(`${range.dateTo}T00:00:00`)
  to.setDate(to.getDate() + 1)
  return { createdFrom: from.toISOString(), createdTo: to.toISOString() }
}

export default function SummaryPage() {
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const [range, setRange] = useState<DateRange>(initialRange)
  const enabled = !isLoadingOutlets
  const params = { outletId, dateFrom: range.dateFrom, dateTo: range.dateTo }
  const stats = useDashboardStats(params, { enabled })
  const charts = useDashboardCharts(params, { enabled })
  const breakdown = useDashboardBreakdown(params, { enabled })
  const customers = useAnalyticsCustomers(params, { enabled })
  const domains = useAnalyticsDashboard(params, { enabled })
  const orders = useOrders({ outletId: outletId ?? undefined, ...orderRange(range), limit: 500 }, { enabled })
  const purchaseParams = { outletId, dateFrom: range.dateFrom, dateTo: range.dateTo, limit: 5000 }
  const purchaseOrders = useReport("purchase-orders", purchaseParams, { enabled })
  const goodsReceiving = useReport("goods-receiving", purchaseParams, { enabled })
  const purchaseReturns = useReport("purchase-returns", purchaseParams, { enabled })
  const supplierPayments = useReport("supplier-payments", purchaseParams, { enabled })
  const rows = orders.data?.data ?? []
  const totals = useMemo(() => rows.reduce((sum, order) => ({
    subtotal: sum.subtotal + order.subtotal,
    discount: sum.discount + order.discountAmount,
    service: sum.service + order.serviceChargeAmount,
    tax: sum.tax + order.taxAmount,
    total: sum.total + order.grandTotal,
    paid: sum.paid + order.paidAmount,
    due: sum.due + order.dueAmount,
    refunded: sum.refunded + order.refundedAmount,
  }), { subtotal: 0, discount: 0, service: 0, tax: 0, total: 0, paid: 0, due: 0, refunded: 0 }), [rows])
  const completed = rows.filter((order) => order.status === "completed").length
  const cancelled = rows.filter((order) => order.status === "cancelled").length
  const ordersReady = !orders.isLoading && !orders.isError
  const moneyOrDash = (value: number) => ordersReady ? money(value) : "—"

  usePageTitle("Period Summary")
  return (
    <div className="page-shell space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Period Summary</h1></div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-sm"><DateRangeFilter compact value={range} onChange={setRange} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={ClipboardListIcon} label="Order count" value={stats.data ? String(stats.data.salesOverview.orderCount) : "—"} />
        <StatCard icon={CircleDollarSignIcon} label="Average order value" value={stats.data ? money(stats.data.salesOverview.avgOrderValue) : "—"} />
        <StatCard icon={BanknoteIcon} label="Completed / cancelled" value={ordersReady ? completed + " / " + cancelled : "—"} description="Orders by final status" />
        <StatCard icon={UsersIcon} label="New / returning customers" value={customers.data ? String(customers.data.kpis?.newCustomers ?? "—") + " / " + String(customers.data.kpis?.returningCustomers ?? "—") : "—"} description="Customers in this period" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
        <Card><CardHeader><CardTitle>Revenue summary</CardTitle><CardDescription>Aggregated from orders in this period</CardDescription></CardHeader><CardContent className="space-y-3">{[["Subtotal", totals.subtotal], ["Discount", -totals.discount], ["Service charge", totals.service], ["Tax", totals.tax], ["Grand total", totals.total], ["Paid", totals.paid], ["Due", totals.due], ["Refunded", -totals.refunded]].map(([label, value], index) => <div key={String(label)} className={index === 4 ? "flex items-center justify-between border-t pt-3 text-base font-semibold" : "flex items-center justify-between text-sm"}><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{moneyOrDash(Number(value))}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Revenue over time</CardTitle><CardDescription>Daily revenue within the selected range</CardDescription></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.data?.revenueTrend ?? []}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="grandTotal" name="Revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
      <Card><CardHeader><CardTitle>Payment breakdown</CardTitle><CardDescription>Collected amounts grouped by payment channel</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{(breakdown.data?.paymentBreakdown ?? []).map((row) => <TableRow key={row.method}><TableCell className="capitalize">{row.method.replaceAll("_", " ")}</TableCell><TableCell className="text-right font-medium">{money(row.amount)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>Purchasing activity</CardTitle><CardDescription>Procure-to-pay movements and supplier orders</CardDescription></CardHeader><CardContent className="space-y-5">
        {purchaseOrders.data?.meta.total === 0 && goodsReceiving.data?.meta.total === 0 && purchaseReturns.data?.meta.total === 0 && supplierPayments.data?.meta.total === 0 ? <div className="flex flex-col items-center justify-center py-5 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><PackageIcon className="size-6" /></div><p className="mt-3 text-sm font-semibold">No purchasing activity</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">There are no purchase orders or supplier movements in this period.</p><Button className="mt-4" size="sm" render={<Link href="/dashboard/purchase-orders" />}><PlusIcon /> Create purchase order</Button></div> : null}
        <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead className="text-right">Records</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>
        <TableRow><TableCell>Purchase orders</TableCell><TableCell className="text-right">{purchaseOrders.data?.meta.total ?? 0}</TableCell><TableCell className="text-right font-medium">{money(purchaseOrders.data?.data.reduce((sum, row) => sum + Number(row.grandTotal ?? 0), 0) ?? 0)}</TableCell></TableRow>
        <TableRow><TableCell>Goods receiving</TableCell><TableCell className="text-right">{goodsReceiving.data?.meta.total ?? 0}</TableCell><TableCell className="text-right">—</TableCell></TableRow>
        <TableRow><TableCell>Purchase returns</TableCell><TableCell className="text-right">{purchaseReturns.data?.meta.total ?? 0}</TableCell><TableCell className="text-right font-medium">{money(purchaseReturns.data?.data.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0) ?? 0)}</TableCell></TableRow>
        <TableRow><TableCell>Supplier payments</TableCell><TableCell className="text-right">{supplierPayments.data?.meta.total ?? 0}</TableCell><TableCell className="text-right font-medium">{money(supplierPayments.data?.data.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0)}</TableCell></TableRow>
      </TableBody></Table></CardContent></Card>
      </div>
      {domains.data && <AllDomainData domains={domains.data.domains} />}
    </div>
  )
}

const domainLabels: Record<string, string> = {
  "purchase-orders": "Purchase orders",
  "goods-receiving": "Goods receiving",
  "purchase-returns": "Purchase returns",
  "supplier-payments": "Supplier payments",
  reservations: "Reservations",
  attendance: "Attendance",
  shifts: "Shift assignments",
  "loyalty-transactions": "Loyalty transactions",
  "audit-logs": "System audit logs",
}

function AllDomainData({ domains }: { domains: Record<string, { data: Record<string, unknown>[]; meta: { total: number }; columns?: { key: string; header: string }[] }> }) {
  return <Card><CardHeader><CardTitle>All domain activity</CardTitle><CardDescription>Real records across every operational domain in the selected period</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(domains).map(([key, report]) => {
    const columns = report.columns?.slice(0, 3) ?? Object.keys(report.data[0] ?? {}).slice(0, 3).map((column) => ({ key: column, header: column.replaceAll("_", " ") }))
    return <div key={key} className="overflow-hidden rounded-xl border bg-muted/10"><div className="flex items-center justify-between gap-2 border-b px-3 py-2.5"><span className="text-sm font-semibold">{domainLabels[key] ?? key}</span><span className="text-xs tabular-nums text-muted-foreground">{report.meta.total.toLocaleString()} records</span></div>{report.data.length ? <Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} className="max-w-32 truncate px-3 text-xs capitalize">{column.header}</TableHead>)}</TableRow></TableHeader><TableBody>{report.data.slice(0, 3).map((row, index) => <TableRow key={index}>{columns.map((column) => <TableCell key={column.key} className="max-w-32 truncate px-3 py-2 text-xs">{domainCell(row[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table> : <p className="px-3 py-6 text-center text-xs text-muted-foreground">No activity in this period.</p>}</div>
  })}</CardContent></Card>
}

function domainCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "object") return "Details"
  return String(value)
}
