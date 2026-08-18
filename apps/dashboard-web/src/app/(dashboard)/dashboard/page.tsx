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
import {
  AlertTriangleIcon,
  ChefHatIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  Trash2Icon,
  UtensilsCrossedIcon,
  WalletIcon,
  WalletCardsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { DateRangeFilter } from "@/components/date-range-filter"
import { StatCard } from "@/components/stat-card"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import {
  useDashboardBreakdown,
  useDashboardCharts,
  useDashboardInventoryActivity,
  useDashboardStats,
} from "@/hooks/use-dashboard"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"

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

interface SectionProps {
  outletId: number | null
  range: { dateFrom: string; dateTo: string }
  enabled: boolean
}

function StatCardsSection({ outletId, range, enabled }: SectionProps) {
  const { data, isLoading } = useDashboardStats({ outletId, ...range }, { enabled })
  const showSkeleton = useDelayedLoading(isLoading || !data)

  if (showSkeleton) return <StatGridSkeleton count={8} className="grid-cols-2 md:grid-cols-4" />
  if (!data) return null

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard icon={ShoppingBagIcon} label="Orders" value={String(data.salesOverview.orderCount)} />
      <StatCard icon={WalletIcon} label="Revenue" value={money(data.salesOverview.grandTotal)} />
      <StatCard icon={ReceiptIcon} label="Avg order value" value={money(data.salesOverview.avgOrderValue)} />
      <StatCard
        icon={UtensilsCrossedIcon}
        label="Active table sessions"
        value={String(data.activeTableSessions)}
      />
      <StatCard
        icon={ChefHatIcon}
        label="Kitchen"
        value={`${data.kitchenOverview.openTickets + data.kitchenOverview.inProgressTickets} active`}
        description={
          data.kitchenOverview.avgPrepMinutes !== null
            ? `Avg prep ${data.kitchenOverview.avgPrepMinutes.toFixed(1)}m`
            : undefined
        }
      />
      <StatCard
        icon={AlertTriangleIcon}
        label="Low stock"
        value={String(data.inventoryOverview.lowStockCount)}
        description={`${data.inventoryOverview.outOfStockCount} out of stock`}
      />
      <StatCard
        icon={Trash2Icon}
        label="Wastage cost"
        value={money(data.wastageSummary.reduce((sum, w) => sum + w.totalCost, 0))}
      />
      <StatCard
        icon={WalletCardsIcon}
        label="Payments collected"
        value={money(data.paymentBreakdown.reduce((sum, p) => sum + p.amount, 0))}
      />
    </div>
  )
}

function ChartsSection({ outletId, range, enabled }: SectionProps) {
  const { data, isLoading } = useDashboardCharts({ outletId, ...range }, { enabled })
  const showSkeleton = useDelayedLoading(isLoading || !data)

  const revenueTrendData = useMemo(
    () => (data?.revenueTrend ?? []).map((d) => ({ ...d, label: d.date.slice(5) })),
    [data],
  )
  const bestSellersData = useMemo(() => (data?.bestSellingFoods ?? []).slice(0, 8), [data])

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }
  if (!data) return null

  return (
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
  )
}

function BreakdownSection({ outletId, range, enabled }: SectionProps) {
  const { data, isLoading } = useDashboardBreakdown({ outletId, ...range }, { enabled })
  const showSkeleton = useDelayedLoading(isLoading || !data)

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (!data) return null

  return (
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
  )
}

function InventoryActivitySection({ outletId, range, enabled }: SectionProps) {
  const { data, isLoading } = useDashboardInventoryActivity({ outletId, ...range }, { enabled })
  const showSkeleton = useDelayedLoading(isLoading || !data)

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Low stock ingredients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {data.lowStockItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing low on stock</p>
          ) : (
            data.lowStockItems.map((item) => (
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
  )
}

export default function DashboardPage() {
  const user = useCurrentUser()
  // Outlet is a global concept (see the header switcher) — the dashboard just
  // follows whatever's currently active there instead of asking again.
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const [range, setRange] = useState(defaultRange)
  // Wait for the real outlet before firing any widget query — otherwise
  // every section fetches once with outletId undefined (an unscoped
  // all-outlets aggregate) and again once the outlet resolves.
  const dataEnabled = !isLoadingOutlets

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome, {user.name}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your business</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Each section fetches and renders independently — a slow widget never
          blocks the others from appearing. */}
      <StatCardsSection outletId={outletId} range={range} enabled={dataEnabled} />
      <ChartsSection outletId={outletId} range={range} enabled={dataEnabled} />
      <BreakdownSection outletId={outletId} range={range} enabled={dataEnabled} />
      <InventoryActivitySection outletId={outletId} range={range} enabled={dataEnabled} />
    </div>
  )
}
