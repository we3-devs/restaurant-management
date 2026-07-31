"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { DateRangeFilter } from "@/components/date-range-filter"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useDashboardSummary } from "@/hooks/use-dashboard"
import { useOutlets } from "@/hooks/use-outlets"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60_000)
  return { dateFrom: isoDate(from), dateTo: isoDate(to) }
}

function money(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function StatCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="text-xs text-muted-foreground">{description}</CardContent>
      )}
    </Card>
  )
}

const CHART_COLOR = "var(--chart-1)"

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          {entry.name}: {money(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const { data: outlets } = useOutlets({ limit: 100 })
  const [outletId, setOutletId] = useState<number | null>(null)
  const [range, setRange] = useState(defaultRange)

  const { data, isLoading } = useDashboardSummary({ outletId, ...range })

  const revenueTrendData = useMemo(
    () => (data?.revenueTrend ?? []).map((d) => ({ ...d, label: d.date.slice(5) })),
    [data],
  )
  const bestSellersData = useMemo(
    () => (data?.bestSellingFoods ?? []).slice(0, 8),
    [data],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-muted-foreground">Management overview</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1.5">
            <label className="text-sm font-medium">Outlet</label>
            <Select
              value={outletId ? String(outletId) : "all"}
              onValueChange={(v) => setOutletId(v && v !== "all" ? Number(v) : null)}
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
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Orders" value={String(data.salesOverview.orderCount)} />
            <StatCard label="Revenue" value={money(data.salesOverview.grandTotal)} />
            <StatCard label="Avg order value" value={money(data.salesOverview.avgOrderValue)} />
            <StatCard label="Active table sessions" value={String(data.activeTableSessions)} />
            <StatCard
              label="Kitchen"
              value={`${data.kitchenOverview.openTickets + data.kitchenOverview.inProgressTickets} active`}
              description={
                data.kitchenOverview.avgPrepMinutes !== null
                  ? `Avg prep ${data.kitchenOverview.avgPrepMinutes.toFixed(1)}m`
                  : undefined
              }
            />
            <StatCard
              label="Low stock"
              value={String(data.inventoryOverview.lowStockCount)}
              description={`${data.inventoryOverview.outOfStockCount} out of stock`}
            />
            <StatCard
              label="Wastage cost"
              value={money(data.wastageSummary.reduce((sum, w) => sum + w.totalCost, 0))}
            />
            <StatCard
              label="Payments collected"
              value={money(data.paymentBreakdown.reduce((sum, p) => sum + p.amount, 0))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue trend</CardTitle>
                <CardDescription>Daily revenue over the selected range</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {revenueTrendData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No orders in this range
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="grandTotal"
                        name="Revenue"
                        stroke={CHART_COLOR}
                        strokeWidth={2}
                        fill={CHART_COLOR}
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best-selling foods</CardTitle>
                <CardDescription>By quantity sold in range</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {bestSellersData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No sales in this range
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bestSellersData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis
                        dataKey="foodName"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={100}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="quantitySold" name="Qty sold" fill={CHART_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Orders by status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.ordersOverview.map((row) => (
                  <Badge key={row.status} variant="secondary">
                    {row.status}: {row.count}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.reservationsSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reservations in range</p>
                ) : (
                  data.reservationsSummary.map((row) => (
                    <Badge key={row.status} variant="secondary">
                      {row.status}: {row.count}
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment methods</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments in range</p>
                ) : (
                  data.paymentBreakdown.map((row) => (
                    <Badge key={row.method} variant="secondary">
                      {row.method}: {money(row.amount)}
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Low stock ingredients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.inventoryOverview.lowStockItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing low on stock</p>
                ) : (
                  data.inventoryOverview.lowStockItems.map((item) => (
                    <div key={item.ingredientId} className="flex items-center justify-between text-sm">
                      <span>{item.ingredientName}</span>
                      <span className="text-muted-foreground">
                        {item.quantity} / {item.reorderLevel}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                ) : (
                  data.recentActivity.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{item.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
