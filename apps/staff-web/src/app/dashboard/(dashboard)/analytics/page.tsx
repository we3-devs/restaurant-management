"use client"

import { Area, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts"
import { useState } from "react"
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAnalyticsDashboard } from "@/hooks/use-analytics"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { usePageTitle } from "@rms/ui/use-page-title"

const iso = (d: Date) => d.toISOString().slice(0, 10)
const initialRange = (): DateRange => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 29); return { dateFrom: iso(from), dateTo: iso(to) } }
const money = (v: number) => "NPR " + Math.round(v).toLocaleString()
const compactNumber = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v))
const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" }
const gridStroke = { stroke: "var(--border)", strokeDasharray: "3 3" }
const barCursor = { fill: "hsl(var(--muted))", opacity: 0.6 }
const domainLabels: Record<string, string> = { "purchase-orders": "Purchase orders", "goods-receiving": "Goods receiving", "purchase-returns": "Purchase returns", "supplier-payments": "Supplier payments", reservations: "Reservations", attendance: "Attendance", shifts: "Shifts", "loyalty-transactions": "Loyalty transactions", "audit-logs": "Audit events" }
const revenueChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }, orders: { label: "Orders", color: "hsl(var(--chart-3))" } }
const paymentChartConfig = { amount: { label: "Amount", color: "hsl(var(--chart-2))" } }
const customerChartConfig = { newCount: { label: "New", color: "hsl(var(--chart-2))" }, returningCount: { label: "Returning", color: "hsl(var(--chart-3))" } }
const inventoryChartConfig = { quantity: { label: "Quantity", color: "hsl(var(--chart-5))" } }
const domainChartConfig = { records: { label: "Records", color: "hsl(var(--chart-1))" } }
const mixChartConfig = { type0: { label: "Table", color: "hsl(var(--chart-1))" }, type1: { label: "Grab & go", color: "hsl(var(--chart-2))" }, type2: { label: "Delivery", color: "hsl(var(--chart-3))" }, type3: { label: "Stay", color: "hsl(var(--chart-4))" }, type4: { label: "Other", color: "hsl(var(--chart-5))" } }

export default function AnalyticsPage() {
  const { outletId, departmentId, isLoadingOutlets } = useActiveOutlet()
  const [range, setRange] = useState<DateRange>(initialRange)
  const [orderSource, setOrderSource] = useState("all")
  const [orderType, setOrderType] = useState("all")
  const query = useAnalyticsDashboard({ outletId, departmentId, dateFrom: range.dateFrom, dateTo: range.dateTo, orderSource: orderSource === "all" ? undefined : orderSource, orderType: orderType === "all" ? undefined : orderType }, { enabled: !isLoadingOutlets })
  const data = query.data
  usePageTitle("Analytics")

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Analytics</h1></div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm">
          <DateRangeFilter compact value={range} onChange={setRange} />
          <Select value={orderSource} onValueChange={(v) => v && setOrderSource(v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
              <SelectItem value="qr">QR</SelectItem>
              <SelectItem value="waiter">Waiter</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orderType} onValueChange={(v) => v && setOrderType(v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All order types</SelectItem>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="grab_and_go">Grab & go</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="stay">Stay</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.isLoading ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading all domain analytics…</CardContent></Card>
      ) : query.isError ? (
        <Card><CardContent className="py-16 text-center text-sm text-destructive">Could not load analytics. <button className="ml-2 underline" onClick={() => void query.refetch()}>Retry</button></CardContent></Card>
      ) : data ? (
        <AnalyticsContent data={data} />
      ) : null}
    </div>
  )
}

function AnalyticsContent({ data }: { data: NonNullable<ReturnType<typeof useAnalyticsDashboard>["data"]> }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.6fr]">
        <MixDonutCard title="Sales mix" subtitle="Orders by order type" rows={data.sales.orderMix.types.map((r) => ({ name: r.name, value: r.orders }))} />
        <RevenueTrendCard data={data.sales.trend} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <PaymentBreakdownCard rows={data.sales.paymentMix} />
        <MixCard title="Top foods" rows={data.products.foods.slice(0, 8).map((r) => ({ name: r.food, value: money(r.revenue), detail: `${r.quantity} sold` }))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerTrendCard data={data.customers.trend} />
        <InventoryMovementCard rows={data.inventory.movement} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MixCard title="Sales by category" rows={data.products.categories.slice(0, 8).map((r) => ({ name: r.category, value: money(r.revenue) }))} />
        <MixCard title="Sales by source" rows={data.sales.orderMix.sources.map((r) => ({ name: r.name, value: money(r.revenue), detail: `${r.orders} orders` }))} />
      </div>
      <DomainActivityCard domains={data.domains} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(data.domains).map(([key, value]) => <DomainTable key={key} title={domainLabels[key] ?? key} report={value} />)}
      </div>
    </div>
  )
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/70 px-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function RevenueTrendCard({ data }: { data: { date: string; orders: number; revenue: number }[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Revenue over time</CardTitle>
          <CardDescription>Daily revenue and order activity</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />Revenue</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--chart-3))" }} />Orders</span>
        </div>
      </CardHeader>
      <CardContent className="h-64">
        {data.length < 2 ? (
          <ChartEmpty label="Not enough daily data for this range." />
        ) : (
          <ChartContainer id="revenue-trend" config={revenueChartConfig}>
            <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} {...gridStroke} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} interval="equidistantPreserveStart" tick={axisTick} tickMargin={8} />
              <YAxis yAxisId="revenue" axisLine={false} tickLine={false} width={52} tick={axisTick} tickMargin={4} tickFormatter={compactNumber} />
              <YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} width={32} allowDecimals={false} tick={axisTick} tickMargin={2} />
              <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
              <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="none" fill="url(#revenue-fill)" />
              <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="var(--color-orders)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function MixDonutCard({ title, subtitle, rows }: { title: string; subtitle: string; rows: { name: string; value: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{subtitle}</CardDescription></CardHeader>
      <CardContent className="flex min-h-64 items-center gap-5">
        {rows.length === 0 ? (
          <div className="h-64 w-full"><ChartEmpty label="No order mix for this range." /></div>
        ) : (
          <>
            <div className="relative h-44 w-44 shrink-0">
              <ChartContainer id="sales-mix" config={mixChartConfig}>
                <PieChart>
                  <Pie data={rows} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={3} stroke="var(--card)">
                    {rows.map((row, index) => <Cell key={row.name} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{total}</span>
                <span className="text-xs text-muted-foreground">orders</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {rows.map((row, index) => (
                <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 truncate capitalize">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }} />
                    {row.name.replaceAll("_", " ")}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{total ? Math.round((row.value / total) * 100) : 0}%</span>
                    <span className="font-semibold tabular-nums">{row.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentBreakdownCard({ rows }: { rows: { name: string; amount: number }[] }) {
  const hasData = rows.some((row) => row.amount > 0)
  return (
    <Card>
      <CardHeader><CardTitle>Payment breakdown</CardTitle><CardDescription>Collected amount by method</CardDescription></CardHeader>
      <CardContent className="h-64">
        {!hasData ? (
          <ChartEmpty label="No payments recorded for this range." />
        ) : (
          <ChartContainer id="payment-breakdown" config={paymentChartConfig}>
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 12, top: 4, bottom: 4 }} barSize={18}>
              <CartesianGrid horizontal={false} {...gridStroke} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickMargin={6} tickFormatter={compactNumber} />
              <YAxis type="category" dataKey="name" width={84} axisLine={false} tickLine={false} tick={{ ...axisTick, fontSize: 12 }} />
              <Tooltip content={<ChartTooltipContent />} cursor={barCursor} />
              <Bar dataKey="amount" name="Amount" fill="var(--color-amount)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function CustomerTrendCard({ data }: { data: { date: string; newCount: number; returningCount: number }[] }) {
  const hasData = data.some((row) => row.newCount > 0 || row.returningCount > 0)
  return (
    <Card>
      <CardHeader><CardTitle>Customer growth</CardTitle><CardDescription>New and returning customers by day</CardDescription></CardHeader>
      <CardContent className="h-64">
        {!hasData ? (
          <ChartEmpty label="No customer activity for this range." />
        ) : (
          <ChartContainer id="customer-growth" config={customerChartConfig}>
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={14}>
              <CartesianGrid vertical={false} {...gridStroke} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} interval="equidistantPreserveStart" tick={axisTick} tickMargin={8} />
              <YAxis axisLine={false} tickLine={false} width={36} allowDecimals={false} tick={axisTick} tickMargin={4} />
              <Tooltip content={<ChartTooltipContent />} cursor={barCursor} />
              <Bar dataKey="newCount" name="New" stackId="customers" fill="var(--color-newCount)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="returningCount" name="Returning" stackId="customers" fill="var(--color-returningCount)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function InventoryMovementCard({ rows }: { rows: { type: string; quantity: number }[] }) {
  const hasData = rows.some((row) => row.quantity !== 0)
  return (
    <Card>
      <CardHeader><CardTitle>Inventory movement</CardTitle><CardDescription>Stock activity in the selected period</CardDescription></CardHeader>
      <CardContent className="h-64">
        {!hasData ? (
          <ChartEmpty label="No stock movement for this range." />
        ) : (
          <ChartContainer id="inventory-movement" config={inventoryChartConfig}>
            <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={22}>
              <CartesianGrid vertical={false} {...gridStroke} />
              <XAxis dataKey="type" axisLine={false} tickLine={false} tick={{ ...axisTick, fontSize: 12 }} tickMargin={8} />
              <YAxis axisLine={false} tickLine={false} width={36} allowDecimals={false} tick={axisTick} tickMargin={4} />
              <Tooltip content={<ChartTooltipContent />} cursor={barCursor} />
              <Bar dataKey="quantity" name="Quantity" fill="var(--color-quantity)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function DomainActivityCard({ domains }: { domains: NonNullable<ReturnType<typeof useAnalyticsDashboard>["data"]>["domains"] }) {
  const rows = Object.entries(domains).map(([key, report]) => ({ name: domainLabels[key] ?? key.replaceAll("-", " "), records: report.meta.total })).filter((row) => row.records > 0)
  return (
    <Card>
      <CardHeader><CardTitle>Activity across every domain</CardTitle><CardDescription>Records available in the selected period</CardDescription></CardHeader>
      <CardContent className="h-72">
        {rows.length === 0 ? (
          <ChartEmpty label="No domain activity for this range." />
        ) : (
          <ChartContainer id="domain-activity" config={domainChartConfig}>
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 12, top: 4, bottom: 4 }} barSize={16}>
              <CartesianGrid horizontal={false} {...gridStroke} />
              <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={axisTick} tickMargin={6} tickFormatter={compactNumber} />
              <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ ...axisTick, fontSize: 12 }} />
              <Tooltip content={<ChartTooltipContent />} cursor={barCursor} />
              <Bar dataKey="records" name="Records" fill="var(--color-records)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function DomainTable({ title, report }: { title: string; report: NonNullable<ReturnType<typeof useAnalyticsDashboard>["data"]>["domains"][string] }) {
  const columns = report.columns?.slice(0, 4) ?? Object.keys(report.data[0] ?? {}).slice(0, 4).map((key) => ({ key, header: key.replaceAll("_", " ") }))
  const rows = report.data.slice(0, 5)
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="capitalize">{title}</CardTitle>
            <CardDescription>Daily activity in the selected range</CardDescription>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">{report.meta.total.toLocaleString()} records</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        {rows.length ? (
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {columns.map((column) => <th key={column.key} className="px-2 py-2 font-medium capitalize">{column.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-0">
                  {columns.map((column) => <td key={column.key} className="max-w-[180px] truncate px-2 py-2">{formatCell(row[column.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-7 text-center text-sm text-muted-foreground">No activity for this range.</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "object") return "Details"
  return String(value)
}

function MixCard({ title, rows }: { title: string; rows: { name: string; value: string | number; detail?: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0">
            <span className="min-w-0 truncate capitalize">
              {row.name.replaceAll("_", " ")}
              {row.detail && <small className="ml-2 text-muted-foreground">{row.detail}</small>}
            </span>
            <span className="font-medium">{row.value}</span>
          </div>
        )) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>
        )}
      </CardContent>
    </Card>
  )
}
