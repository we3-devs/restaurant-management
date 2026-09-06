"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useState } from "react"
import { BoxesIcon, CircleDollarSignIcon, ClipboardListIcon, PackageIcon, UsersIcon } from "lucide-react"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/stat-card"
import { useAnalyticsDashboard } from "@/hooks/use-analytics"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"

const iso = (d: Date) => d.toISOString().slice(0, 10)
const initialRange = (): DateRange => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 29); return { dateFrom: iso(from), dateTo: iso(to) } }
const money = (v: number) => "NPR " + Math.round(v).toLocaleString()
const domainLabels: Record<string, string> = { "purchase-orders": "Purchase orders", "goods-receiving": "Goods receiving", "purchase-returns": "Purchase returns", "supplier-payments": "Supplier payments", reservations: "Reservations", attendance: "Attendance", shifts: "Shifts", "loyalty-transactions": "Loyalty transactions", "audit-logs": "Audit events" }

export default function AnalyticsPage() {
  const { outletId, departmentId, isLoadingOutlets } = useActiveOutlet()
  const [range, setRange] = useState<DateRange>(initialRange)
  const [orderSource, setOrderSource] = useState("all")
  const [orderType, setOrderType] = useState("all")
  const query = useAnalyticsDashboard({ outletId, departmentId, dateFrom: range.dateFrom, dateTo: range.dateTo, orderSource: orderSource === "all" ? undefined : orderSource, orderType: orderType === "all" ? undefined : orderType }, { enabled: !isLoadingOutlets })
  const data = query.data
  usePageTitle("Analytics")

  return <div className="page-shell space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1></div><div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-sm"><DateRangeFilter compact value={range} onChange={setRange} /><Select value={orderSource} onValueChange={(v) => v && setOrderSource(v)}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem><SelectItem value="pos">POS</SelectItem><SelectItem value="qr">QR</SelectItem><SelectItem value="waiter">Waiter</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent></Select><Select value={orderType} onValueChange={(v) => v && setOrderType(v)}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All order types</SelectItem><SelectItem value="table">Table</SelectItem><SelectItem value="grab_and_go">Grab & go</SelectItem><SelectItem value="delivery">Delivery</SelectItem><SelectItem value="stay">Stay</SelectItem></SelectContent></Select></div></div>
    {query.isLoading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading all domain analytics…</CardContent></Card> : query.isError ? <Card><CardContent className="py-16 text-center text-sm text-destructive">Could not load analytics. <button className="ml-2 underline" onClick={() => void query.refetch()}>Retry</button></CardContent></Card> : data ? <AnalyticsContent data={data} /> : null}
  </div>
}

function AnalyticsContent({ data }: { data: NonNullable<ReturnType<typeof useAnalyticsDashboard>["data"]> }) {
  const k = data.sales.kpis
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-6"><StatCard icon={CircleDollarSignIcon} label="Gross revenue" value={money(k.grossSales)} /><StatCard icon={CircleDollarSignIcon} label="Net revenue" value={money(k.netSales)} /><StatCard icon={ClipboardListIcon} label="Orders" value={String(k.orders)} /><StatCard icon={PackageIcon} label="Items sold" value={String(k.itemsSold)} /><StatCard icon={UsersIcon} label="Customers" value={String(k.customers)} /><StatCard icon={BoxesIcon} label="Inventory value" value={money(data.inventory.kpis.inventoryValue)} /></div>
    <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]"><Card><CardHeader><CardTitle>Revenue trend</CardTitle><CardDescription>Daily revenue across the selected period</CardDescription></CardHeader><CardContent className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.sales.trend}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card><MixCard title="Sales by order type" rows={data.sales.orderMix.types.map((r) => ({ name: r.name, value: r.orders }))} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><MixCard title="Sales by category" rows={data.products.categories.slice(0, 8).map((r) => ({ name: r.category, value: money(r.revenue), amount: r.revenue }))} /><MixCard title="Top foods" rows={data.products.foods.slice(0, 10).map((r) => ({ name: r.food, value: money(r.revenue), amount: r.revenue, detail: String(r.quantity) + " sold" }))} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Customers</CardTitle><CardDescription>New versus returning in the selected period</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3"><StatCard icon={UsersIcon} label="New" value={String(data.customers.kpis.newCustomers ?? 0)} /><StatCard icon={UsersIcon} label="Returning" value={String(data.customers.kpis.returningCustomers ?? 0)} /></CardContent></Card><Card><CardHeader><CardTitle>Inventory health</CardTitle><CardDescription>Current stock condition and selected-period movement</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-3"><StatCard icon={BoxesIcon} label="Low stock" value={String(data.inventory.kpis.lowStock ?? 0)} /><StatCard icon={BoxesIcon} label="Out of stock" value={String(data.inventory.kpis.outOfStock ?? 0)} /><StatCard icon={BoxesIcon} label="Reserved" value={String(data.inventory.kpis.reservedStock ?? 0)} /></CardContent></Card></div>
    <div className="grid gap-4 lg:grid-cols-2">{Object.entries(data.domains).map(([key, value]) => <DomainTable key={key} title={domainLabels[key] ?? key} report={value} />)}</div>
  </div>
}

function DomainTable({ title, report }: { title: string; report: NonNullable<ReturnType<typeof useAnalyticsDashboard>["data"]>["domains"][string] }) {
  const columns = report.columns?.slice(0, 4) ?? Object.keys(report.data[0] ?? {}).slice(0, 4).map((key) => ({ key, header: key.replaceAll("_", " ") }))
  const rows = report.data.slice(0, 5)
  return <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="capitalize">{title}</CardTitle><CardDescription>Daily activity in the selected range</CardDescription></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">{report.meta.total.toLocaleString()} records</span></div></CardHeader><CardContent className="overflow-x-auto pt-0">{rows.length ? <table className="w-full min-w-[420px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground">{columns.map((column) => <th key={column.key} className="px-2 py-2 font-medium capitalize">{column.header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b last:border-0">{columns.map((column) => <td key={column.key} className="max-w-[180px] truncate px-2 py-2">{formatCell(row[column.key])}</td>)}</tr>)}</tbody></table> : <p className="py-7 text-center text-sm text-muted-foreground">No activity for this range.</p>}</CardContent></Card>
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "object") return "Details"
  return String(value)
}

function MixCard({ title, rows }: { title: string; rows: { name: string; value: string | number; detail?: string }[] }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length ? rows.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0"><span className="min-w-0 truncate capitalize">{row.name.replaceAll("_", " ")}{row.detail && <small className="ml-2 text-muted-foreground">{row.detail}</small>}</span><span className="font-medium">{row.value}</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>}</CardContent></Card> }
