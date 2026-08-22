"use client"

import { useMemo } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChefHatIcon, ReceiptIcon, ShoppingBagIcon, Trash2Icon, WalletCardsIcon, WalletIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import type { PeriodInsightPayload } from "@/hooks/use-period-insights"
import { CHART_COLOR, ChartTooltip, money } from "../_shared/dashboard-sections"

/**
 * Pure, payload-driven counterparts of the `_shared/dashboard-sections.tsx`
 * widgets — those fetch a live `{outletId, dateFrom, dateTo}` range
 * themselves, but a period_insights row is a single precomputed payload
 * the Summary page already has in hand, so these just render it. Only
 * covers the fields period_insights actually stores (no active table
 * sessions, low-stock/inventory, reservations, or activity feed — those
 * are point-in-time state, not something a closed historical period has).
 */
export function StatCardsView({ payload }: { payload: PeriodInsightPayload }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard icon={ShoppingBagIcon} label="Orders" value={String(payload.salesOverview.orderCount)} />
      <StatCard icon={WalletIcon} label="Revenue" value={money(payload.salesOverview.grandTotal)} />
      <StatCard icon={ReceiptIcon} label="Avg order value" value={money(payload.salesOverview.avgOrderValue)} />
      <StatCard
        icon={ChefHatIcon}
        label="Kitchen"
        value={`${payload.kitchenOverview.openTickets + payload.kitchenOverview.inProgressTickets} active`}
        description={
          payload.kitchenOverview.avgPrepMinutes !== null
            ? `Avg prep ${payload.kitchenOverview.avgPrepMinutes.toFixed(1)}m`
            : undefined
        }
      />
      <StatCard
        icon={Trash2Icon}
        label="Wastage cost"
        value={money(payload.wastageSummary.reduce((sum, w) => sum + w.totalCost, 0))}
      />
      <StatCard
        icon={WalletCardsIcon}
        label="Payments collected"
        value={money(payload.paymentBreakdown.reduce((sum, p) => sum + p.amount, 0))}
      />
    </div>
  )
}

export function ChartsView({ payload }: { payload: PeriodInsightPayload }) {
  const revenueTrendData = useMemo(
    () => payload.revenueTrend.map((d) => ({ ...d, label: d.date.slice(5) })),
    [payload.revenueTrend],
  )
  const bestSellersData = useMemo(() => payload.bestSellingFoods.slice(0, 8), [payload.bestSellingFoods])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue trend</CardTitle>
          <CardDescription>Daily revenue within the period</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {revenueTrendData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No orders in this period
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
          <CardDescription>By quantity sold in period</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {bestSellersData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No sales in this period
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

export function BreakdownView({ payload }: { payload: PeriodInsightPayload }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Orders by status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {payload.ordersOverview.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders in period</p>
          ) : (
            payload.ordersOverview.map((row) => (
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
          {payload.paymentBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments in period</p>
          ) : (
            payload.paymentBreakdown.map((row) => (
              <Badge key={row.method} variant="secondary">
                {row.method}: {money(row.amount)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wastage by reason</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {payload.wastageSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wastage in period</p>
          ) : (
            payload.wastageSummary.map((row) => (
              <Badge key={row.reason} variant="secondary">
                {row.reason}: {money(row.totalCost)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
