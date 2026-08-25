"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { LayoutGridIcon, TableIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/stat-card"
import { CardGridSkeleton } from "@/components/ui/skeletons"
import type {
  CustomerAnalytics,
  DashboardAnalytics,
  DiscountRefund,
  IngredientConsumptionAnalytics,
  OrderStatusAnalytic,
  PeakHour,
  PrepPerformance,
  SalesByCategory,
} from "@/hooks/use-analytics"
import { CHART_COLOR, ChartTooltip, money } from "../_shared/chart-utils"
import { pctChange } from "../_shared/operational-sections"

/** New-chart-only palette per design constraint: cyan/amber/emerald, not indigo/violet. */
export const CHART_CYAN = "var(--chart-3)"
export const CHART_AMBER = "var(--chart-4)"
export const CHART_EMERALD = "var(--chart-5)"
export const DONUT_COLORS = [CHART_CYAN, CHART_AMBER, CHART_EMERALD, CHART_COLOR, "var(--chart-2)"]

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" }

export function EmptyState({ message }: { message: string }) {
  return <p className="flex h-full min-h-32 items-center justify-center text-center text-sm text-muted-foreground">{message}</p>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="flex h-full min-h-32 items-center justify-center text-center text-sm text-destructive">
      {message}
    </p>
  )
}

export function SectionLoading() {
  return <CardGridSkeleton count={2} className="grid-cols-1 lg:grid-cols-2" itemClassName="h-64" />
}

/** Local chart/table toggle for ranking-style sections. Purely client-side, no persistence. */
export function ViewToggle({ view, onChange }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <Tabs value={view} onValueChange={(v) => v && onChange(v as "chart" | "table")}>
      <TabsList>
        <TabsTrigger value="chart">
          <LayoutGridIcon className="size-3.5" /> Chart
        </TabsTrigger>
        <TabsTrigger value="table">
          <TableIcon className="size-3.5" /> Table
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

// ---------------------------------------------------------------------
// Insights strip
// ---------------------------------------------------------------------

export interface Insight {
  text: string
}

/** Computes 3-5 one-line insights purely from the fetched current-vs-previous analytics payloads. No hardcoded/random content. */
export function buildInsights(current: DashboardAnalytics, previous: DashboardAnalytics): Insight[] {
  const insights: Insight[] = []

  const currentRevenue = current.peakHours.reduce((sum, h) => sum + h.revenue, 0)
  const previousRevenue = previous.peakHours.reduce((sum, h) => sum + h.revenue, 0)
  const revenueChange = pctChange(currentRevenue, previousRevenue)
  if (revenueChange !== undefined) {
    insights.push({
      text: `Revenue is ${revenueChange >= 0 ? "up" : "down"} ${Math.abs(revenueChange).toFixed(1)}% vs the previous period (${money(currentRevenue)} vs ${money(previousRevenue)}).`,
    })
  }

  const busiestHour = [...current.peakHours].sort((a, b) => b.orderCount - a.orderCount)[0]
  if (busiestHour) {
    insights.push({ text: `Busiest hour is ${formatHour(busiestHour.hour)} with ${busiestHour.orderCount} orders.` })
  }

  const topCategory = [...current.salesByCategory].sort((a, b) => b.revenue - a.revenue)[0]
  if (topCategory) {
    insights.push({ text: `${topCategory.categoryName} is the top-selling category with ${money(topCategory.revenue)} in revenue.` })
  }

  const topConsumed = current.ingredientConsumption.mostConsumed[0]
  if (topConsumed) {
    insights.push({
      text: `${topConsumed.ingredientName} is the most-consumed ingredient (${topConsumed.totalConsumed.toLocaleString()} ${topConsumed.unitName ?? "units"}).`,
    })
  }

  const totalPayments = current.discountRefund
  if (current.orderStatus.length > 0) {
    const topStatus = [...current.orderStatus].sort((a, b) => b.percentage - a.percentage)[0]
    insights.push({ text: `${topStatus.percentage.toFixed(0)}% of orders are "${topStatus.status}".` })
  } else if (totalPayments.totalDiscount > 0) {
    insights.push({ text: `${money(totalPayments.totalDiscount)} given out in discounts across ${totalPayments.discountedOrderCount} orders.` })
  }

  return insights.slice(0, 5)
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:00 ${period}`
}

export function InsightsStrip({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
        <CardDescription>Auto-generated from this range vs. the previous equivalent range</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {insights.map((insight, i) => (
            <li key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-foreground">
              {insight.text}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Sales tab
// ---------------------------------------------------------------------

export function PeakHoursCard({ data }: { data: PeakHour[] }) {
  const chartData = useMemo(() => data.map((row) => ({ ...row, label: formatHour(row.hour) })), [data])
  const busiest = useMemo(() => (data.length ? [...data].sort((a, b) => b.orderCount - a.orderCount)[0] : null), [data])
  const quietest = useMemo(() => (data.length ? [...data].sort((a, b) => a.orderCount - b.orderCount)[0] : null), [data])
  const avgPerHour = useMemo(
    () => (data.length ? data.reduce((sum, h) => sum + h.orderCount, 0) / data.length : 0),
    [data],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak hours</CardTitle>
        <CardDescription>Orders and revenue by hour of day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <EmptyState message="No orders in this range" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-muted-foreground">Busiest</p>
                <p className="font-semibold text-foreground">{busiest ? formatHour(busiest.hour) : "-"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-muted-foreground">Quietest</p>
                <p className="font-semibold text-foreground">{quietest ? formatHour(quietest.hour) : "-"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-muted-foreground">Avg/hour</p>
                <p className="font-semibold text-foreground">{avgPerHour.toFixed(1)}</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={2} />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={AXIS_TICK} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="orderCount" name="Orders" fill={CHART_CYAN} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function SalesByCategoryCard({ data }: { data: SalesByCategory[] }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const total = useMemo(() => data.reduce((sum, row) => sum + row.revenue, 0), [data])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Sales by category</CardTitle>
          <CardDescription>Revenue and order share per food category</CardDescription>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState message="No category sales in this range" />
        ) : view === "chart" ? (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="revenue" nameKey="categoryName" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((row, i) => (
                      <Cell key={row.categoryId} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {data.slice(0, 8).map((row, i) => (
                <li key={row.categoryId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="truncate">{row.categoryName}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {money(row.revenue)} ({total > 0 ? ((row.revenue / total) * 100).toFixed(0) : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <RankingTable
            rows={data}
            keyField="categoryId"
            columns={[
              { header: "Category", render: (r) => r.categoryName },
              { header: "Revenue", render: (r) => money(r.revenue), align: "right" },
              { header: "Items sold", render: (r) => r.orderCount.toLocaleString(), align: "right" },
              { header: "% share", render: (r) => (total > 0 ? `${((r.revenue / total) * 100).toFixed(1)}%` : "0%"), align: "right" },
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Finance tab
// ---------------------------------------------------------------------

export function PaymentMethodCard({ data }: { data: { method: string; amount: number }[] }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const total = useMemo(() => data.reduce((sum, row) => sum + row.amount, 0), [data])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Payment methods</CardTitle>
          <CardDescription>Share of collected revenue per method</CardDescription>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState message="No payments in this range" />
        ) : view === "chart" ? (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="amount" nameKey="method" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((row, i) => (
                      <Cell key={row.method} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {data.map((row, i) => (
                <li key={row.method} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate capitalize">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {row.method}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {money(row.amount)} ({total > 0 ? ((row.amount / total) * 100).toFixed(0) : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <RankingTable
            rows={data}
            keyField="method"
            columns={[
              { header: "Method", render: (r) => <span className="capitalize">{r.method}</span> },
              { header: "Amount", render: (r) => money(r.amount), align: "right" },
              { header: "% share", render: (r) => (total > 0 ? `${((r.amount / total) * 100).toFixed(1)}%` : "0%"), align: "right" },
            ]}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function DiscountRefundCard({ data }: { data: DiscountRefund }) {
  const trendData = useMemo(() => data.trend.map((d) => ({ ...d, label: d.date.slice(5) })), [data.trend])

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Discounts &amp; refunds</CardTitle>
        <CardDescription>Discount usage and refund activity over the range</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Total discounts" value={money(data.totalDiscount)} />
          <MiniStat label="Discounted orders" value={String(data.discountedOrderCount)} />
          <MiniStat label="Avg discount" value={money(data.avgDiscount)} />
          <MiniStat label="Total refunded" value={money(data.totalRefunded)} />
          <MiniStat label="Refund rate" value={`${data.refundRate.toFixed(1)}%`} />
        </div>
        <div className="h-48">
          {trendData.length === 0 ? (
            <EmptyState message="No discount activity in this range" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={AXIS_TICK} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="discountAmount" name="Discounts" stroke={CHART_AMBER} strokeWidth={2} fill={CHART_AMBER} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ProfitUnavailableCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Profit &amp; expense analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Profit and expense analytics requires cost data (recipe/ingredient costing or an expenses ledger), which
          isn&apos;t tracked yet in this system. Once food cost prices or an expenses table are added, this section can
          be implemented.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Operations tab
// ---------------------------------------------------------------------

export function OrderStatusCard({ data }: { data: OrderStatusAnalytic[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order status</CardTitle>
        <CardDescription>Distribution of orders by status</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState message="No orders in this range" />
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((row, i) => (
                      <Cell key={row.status} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {data.map((row, i) => (
                <li key={row.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <Badge variant="secondary" style={{ background: `color-mix(in srgb, ${DONUT_COLORS[i % DONUT_COLORS.length]} 20%, transparent)` }}>
                      {row.status}
                    </Badge>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.count} ({row.percentage.toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PrepPerformanceCard({ data }: { data: PrepPerformance }) {
  const trendData = useMemo(() => data.trend.map((d) => ({ ...d, label: d.date.slice(5) })), [data.trend])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen prep performance</CardTitle>
        <CardDescription>Avg/fastest/slowest ticket time, vs a {data.expectedMinutes}-minute target</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.totalTickets === 0 ? (
          <EmptyState message="No completed kitchen tickets in this range" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Avg prep" value={data.avgMinutes !== null ? `${data.avgMinutes.toFixed(1)}m` : "-"} />
              <MiniStat label="Fastest" value={data.fastestMinutes !== null ? `${data.fastestMinutes.toFixed(1)}m` : "-"} />
              <MiniStat label="Slowest" value={data.slowestMinutes !== null ? `${data.slowestMinutes.toFixed(1)}m` : "-"} />
              <MiniStat
                label="On-time"
                value={`${data.onTimeCount}/${data.totalTickets}`}
                sub={`${data.delayedCount} delayed`}
              />
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={AXIS_TICK} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="avgMinutes" name="Avg minutes" stroke={CHART_CYAN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Inventory tab
// ---------------------------------------------------------------------

export function IngredientConsumptionCard({
  data,
  lowStockItems,
}: {
  data: IngredientConsumptionAnalytics
  lowStockItems: { ingredientId: number; ingredientName: string; quantity: number; reorderLevel: number }[]
}) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const chartData = useMemo(() => data.mostConsumed.slice(0, 8), [data.mostConsumed])

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Most consumed ingredients</CardTitle>
            <CardDescription>Total quantity consumed via fulfilled orders</CardDescription>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </CardHeader>
        <CardContent>
          {data.mostConsumed.length === 0 ? (
            <EmptyState message="No ingredient consumption recorded in this range" />
          ) : view === "chart" ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                  <YAxis dataKey="ingredientName" type="category" tickLine={false} axisLine={false} width={110} tick={AXIS_TICK} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="totalConsumed" name="Consumed" fill={CHART_EMERALD} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <RankingTable
              rows={data.mostConsumed}
              keyField="ingredientId"
              columns={[
                { header: "Ingredient", render: (r) => r.ingredientName },
                { header: "Consumed", render: (r) => `${r.totalConsumed.toLocaleString()} ${r.unitName ?? ""}`, align: "right" },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Least consumed</CardTitle>
          <CardDescription>Slow-moving ingredients this range</CardDescription>
        </CardHeader>
        <CardContent>
          {data.leastConsumed.length === 0 ? (
            <EmptyState message="Not enough data" />
          ) : (
            <ul className="space-y-1.5">
              {data.leastConsumed.slice(0, 6).map((row) => (
                <li key={row.ingredientId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{row.ingredientName}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.totalConsumed.toLocaleString()} {row.unitName ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Low / out-of-stock alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <EmptyState message="No low-stock alerts" />
          ) : (
            <ul className="space-y-1.5">
              {lowStockItems.slice(0, 8).map((item) => (
                <li key={item.ingredientId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.ingredientName}</span>
                  <Badge variant={item.quantity <= 0 ? "destructive" : "outline"}>
                    {item.quantity <= 0 ? "Out of stock" : `${item.quantity} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------
// Customers tab
// ---------------------------------------------------------------------

export function CustomerAnalyticsCards({ data }: { data: CustomerAnalytics }) {
  const trendData = useMemo(() => data.trend.map((d) => ({ ...d, label: d.date.slice(5) })), [data.trend])

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:col-span-2">
        <StatCard icon={LayoutGridIcon} label="Customers (range)" value={String(data.totalCustomers)} />
        <StatCard icon={LayoutGridIcon} label="New" value={String(data.newCustomers)} />
        <StatCard icon={LayoutGridIcon} label="Returning" value={String(data.returningCustomers)} />
        <StatCard icon={LayoutGridIcon} label="Avg spend" value={money(data.avgSpend)} description={`${data.avgOrdersPerCustomer.toFixed(1)} orders/customer`} />
      </div>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>New vs. returning customers</CardTitle>
          <CardDescription>Daily count over the selected range</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          {trendData.length === 0 ? (
            <EmptyState message="No customer activity in this range" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis tickLine={false} axisLine={false} width={32} tick={AXIS_TICK} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="newCount" name="New" stackId="c" fill={CHART_CYAN} radius={[0, 0, 0, 0]} maxBarSize={18} />
                <Bar dataKey="returningCount" name="Returning" stackId="c" fill={CHART_AMBER} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------
// Shared small pieces
// ---------------------------------------------------------------------

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function RankingTable<T>({
  rows,
  keyField,
  columns,
}: {
  rows: T[]
  keyField: keyof T
  columns: { header: string; render: (row: T) => React.ReactNode; align?: "left" | "right" }[]
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.header} className={col.align === "right" ? "text-right" : undefined}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row[keyField])}>
              {columns.map((col) => (
                <TableCell key={col.header} className={col.align === "right" ? "text-right tabular-nums" : undefined}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
