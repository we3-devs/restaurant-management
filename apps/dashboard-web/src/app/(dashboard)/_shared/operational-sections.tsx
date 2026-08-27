"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChefHatIcon,
  ClockIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  UsersIcon,
  UtensilsCrossedIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"
import { useDashboardStats } from "@/hooks/use-dashboard"
import { useOrders, type Order } from "@/hooks/use-orders"
import { useKdsBootstrap } from "@/hooks/use-kitchen-tickets"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useAttendanceToday } from "@/hooks/use-attendance"
import { money, pctChange } from "./chart-utils"

function isoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function todayRange() {
  const today = isoDate(new Date())
  return { dateFrom: today, dateTo: today }
}

function yesterdayRange() {
  const y = isoDate(new Date(Date.now() - 24 * 60 * 60_000))
  return { dateFrom: y, dateTo: y }
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
}

function elapsedLabel(iso: string): string {
  const m = minutesSince(iso)
  return m < 1 ? "just now" : `${m} min`
}

/** Common shape every operational section takes — mirrors DashboardSectionProps from the analytics widgets, minus the date range (these are always "right now"). */
export interface OperationalSectionProps {
  outletId: number | null
  enabled: boolean
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <span>Couldn&apos;t load this section.</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* KPI strip                                                          */
/* ------------------------------------------------------------------ */

export function OperationalKpiStrip({ outletId, enabled }: OperationalSectionProps) {
  const todayQuery = useDashboardStats({ outletId, ...todayRange() }, { enabled })
  const yesterdayQuery = useDashboardStats({ outletId, ...yesterdayRange() }, { enabled })
  const showSkeleton = useDelayedLoading(todayQuery.isLoading || !todayQuery.data)

  if (showSkeleton) return <StatGridSkeleton count={4} className="grid-cols-2 md:grid-cols-4" />
  if (todayQuery.isError) return <SectionError onRetry={() => todayQuery.refetch()} />
  if (!todayQuery.data) return null

  const data = todayQuery.data
  const yesterday = yesterdayQuery.data
  const pendingOrders = data.ordersOverview.find((o) => o.status === "pending")?.count ?? 0

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        icon={WalletIcon}
        label="Today's Sales"
        value={money(data.salesOverview.grandTotal)}
        trend={
          yesterday
            ? { value: pctChange(data.salesOverview.grandTotal, yesterday.salesOverview.grandTotal) ?? 0, label: "vs yesterday" }
            : undefined
        }
      />
      <StatCard
        icon={ShoppingBagIcon}
        label="Orders Today"
        value={String(data.salesOverview.orderCount)}
        trend={
          yesterday
            ? { value: pctChange(data.salesOverview.orderCount, yesterday.salesOverview.orderCount) ?? 0, label: "vs yesterday" }
            : undefined
        }
      />
      <StatCard icon={UtensilsCrossedIcon} label="Active Tables" value={String(data.activeTableSessions)} />
      <StatCard
        icon={ClockIcon}
        label="Pending Orders"
        value={String(pendingOrders)}
        description={pendingOrders > 0 ? "awaiting kitchen" : "all caught up"}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Live orders                                                        */
/* ------------------------------------------------------------------ */

const LIVE_STATUSES = ["pending", "preparing", "ready", "served"] as const

export function LiveOrdersSection({ outletId, enabled }: OperationalSectionProps) {
  const ordersQuery = useOrders({ outletId: outletId ?? undefined, excludeStatus: ["completed", "cancelled"], limit: 30 }, { enabled })
  const tableSessionsQuery = useTableSessions({ outletId: outletId ?? undefined, status: "active", limit: 100 }, { enabled })
  const diningTablesQuery = useDiningTables({ outletId: outletId ?? undefined, limit: 100 }, { enabled })
  const showSkeleton = useDelayedLoading(ordersQuery.isLoading)

  const tableLabelFor = useMemo(() => {
    const sessions = tableSessionsQuery.data?.data ?? []
    const tables = diningTablesQuery.data?.data ?? []
    return (order: Order): string | null => {
      if (!order.tableSessionId) return null
      const session = sessions.find((s) => s.id === order.tableSessionId)
      if (!session) return null
      const table = tables.find((t) => t.id === session.diningTableId)
      return table?.name ?? null
    }
  }, [tableSessionsQuery.data, diningTablesQuery.data])

  const orders = useMemo(() => ordersQuery.data?.data ?? [], [ordersQuery.data])
  const counts = useMemo(() => {
    const result: Record<(typeof LIVE_STATUSES)[number], number> = { pending: 0, preparing: 0, ready: 0, served: 0 }
    for (const order of orders) {
      if (order.status in result) result[order.status as (typeof LIVE_STATUSES)[number]]++
    }
    return result
  }, [orders])

  const relevantOrders = useMemo(() => {
    const priority: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3 }
    return orders
      .filter((o) => o.status in priority)
      .slice()
      .sort((a, b) => {
        const rank = (priority[a.status] ?? 9) - (priority[b.status] ?? 9)
        if (rank !== 0) return rank
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
      .slice(0, 8)
  }, [orders])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live orders</CardTitle>
        <CardDescription>What&apos;s currently in flight</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSkeleton ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : ordersQuery.isError ? (
          <SectionError onRetry={() => ordersQuery.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              {LIVE_STATUSES.map((status) => (
                <div key={status} className="rounded-lg border bg-muted/30 py-2">
                  <p className="text-lg font-semibold tabular-nums">{counts[status]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                </div>
              ))}
            </div>

            {relevantOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active orders</p>
            ) : (
              <div className="space-y-1">
                {relevantOrders.map((order) => {
                  const tableLabel = tableLabelFor(order)
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">#{order.orderNumber}</span>
                      <span className="shrink-0 text-muted-foreground">{tableLabel ?? order.orderType}</span>
                      <StatusBadge status={order.status} className="shrink-0" />
                      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                        {elapsedLabel(order.createdAt)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Needs attention                                                    */
/* ------------------------------------------------------------------ */

interface AttentionItem {
  id: string
  severity: "critical" | "warning" | "info"
  label: string
  href: string
}

const SEVERITY_STYLES: Record<AttentionItem["severity"], string> = {
  critical: "border-destructive/30 bg-destructive/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  info: "border-sky-500/30 bg-sky-500/5",
}

const SEVERITY_BADGE: Record<AttentionItem["severity"], "destructive" | "warning" | "info"> = {
  critical: "destructive",
  warning: "warning",
  info: "info",
}

export interface NeedsAttentionSectionProps extends OperationalSectionProps {
  canViewOrders: boolean
  canViewKitchen: boolean
  canViewDashboardStats: boolean
}

export function NeedsAttentionSection({ outletId, enabled, canViewOrders, canViewKitchen, canViewDashboardStats }: NeedsAttentionSectionProps) {
  const ordersQuery = useOrders(
    { outletId: outletId ?? undefined, excludeStatus: ["cancelled"], limit: 30 },
    { enabled: enabled && canViewOrders },
  )
  const kdsQuery = useKdsBootstrap(enabled && canViewKitchen ? outletId : null)
  const statsQuery = useDashboardStats({ outletId, ...todayRange() }, { enabled: enabled && canViewDashboardStats })

  const isLoading =
    (canViewOrders && ordersQuery.isLoading) || (canViewKitchen && kdsQuery.isLoading) || (canViewDashboardStats && statsQuery.isLoading)
  const showSkeleton = useDelayedLoading(isLoading)

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = []
    const orders = ordersQuery.data?.data ?? []

    const delayed = orders.filter((o) => ["pending", "preparing"].includes(o.status) && minutesSince(o.createdAt) > 15)
    if (delayed.length > 0) {
      result.push({
        id: "delayed-orders",
        severity: "critical",
        label: `${delayed.length} order${delayed.length > 1 ? "s" : ""} waiting longer than 15 minutes`,
        href: "/orders",
      })
    }

    const unpaid = orders.filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled")
    if (unpaid.length > 0) {
      result.push({
        id: "unpaid-bills",
        severity: "warning",
        label: `${unpaid.length} unpaid bill${unpaid.length > 1 ? "s" : ""}`,
        href: "/orders",
      })
    }

    const tickets = kdsQuery.data?.tickets ?? []
    const delayedTickets = tickets.filter((t) => ["open", "in_progress"].includes(t.status) && minutesSince(t.createdAt) > 20)
    if (delayedTickets.length > 0) {
      result.push({
        id: "delayed-kitchen",
        severity: "critical",
        label: `${delayedTickets.length} delayed kitchen ticket${delayedTickets.length > 1 ? "s" : ""}`,
        href: "/tables",
      })
    }

    const outOfStock = statsQuery.data?.inventoryOverview.outOfStockCount ?? 0
    if (outOfStock > 0) {
      result.push({
        id: "out-of-stock",
        severity: "critical",
        label: `${outOfStock} ingredient${outOfStock > 1 ? "s" : ""} out of stock`,
        href: "/ingredients",
      })
    }

    const lowStock = statsQuery.data?.inventoryOverview.lowStockCount ?? 0
    if (lowStock > 0) {
      result.push({
        id: "low-stock",
        severity: "warning",
        label: `${lowStock} low-stock ingredient${lowStock > 1 ? "s" : ""}`,
        href: "/ingredients",
      })
    }

    return result
  }, [ordersQuery.data, kdsQuery.data, statsQuery.data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>Things that may need action right now</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <CheckCircle2Icon className="size-6 text-emerald-500" />
            <p className="text-sm font-medium">Everything looks good</p>
            <p className="text-xs text-muted-foreground">No action required</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:opacity-80",
                  SEVERITY_STYLES[item.severity],
                )}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  {item.label}
                </span>
                <Badge variant={SEVERITY_BADGE[item.severity]}>{item.severity}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Table status                                                       */
/* ------------------------------------------------------------------ */

const TABLE_STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-destructive",
  reserved: "bg-amber-500",
  cleaning: "bg-muted-foreground",
}

export function TableStatusSection({ outletId, enabled }: OperationalSectionProps) {
  const tablesQuery = useDiningTables({ outletId: outletId ?? undefined, limit: 100 }, { enabled })
  const showSkeleton = useDelayedLoading(tablesQuery.isLoading)

  const counts = useMemo(() => {
    const rows = tablesQuery.data?.data ?? []
    return {
      available: rows.filter((t) => t.status === "available").length,
      occupied: rows.filter((t) => t.status === "occupied").length,
      reserved: rows.filter((t) => t.status === "reserved").length,
      cleaning: rows.filter((t) => t.status === "cleaning").length,
    }
  }, [tablesQuery.data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables</CardTitle>
        <CardDescription>Floor status at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : tablesQuery.isError ? (
          <SectionError onRetry={() => tablesQuery.refetch()} />
        ) : (tablesQuery.data?.data.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No tables configured</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["available", "occupied", "reserved", "cleaning"] as const).map((status) => (
                <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="flex items-center gap-2 text-sm capitalize text-muted-foreground">
                    <span className={cn("size-2 rounded-full", TABLE_STATUS_DOT[status])} />
                    {status}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{counts[status]}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" render={<Link href="/tables" />}>
              View floor plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Dining areas                                                       */
/* ------------------------------------------------------------------ */

export function DiningAreasSection({ outletId, enabled }: OperationalSectionProps) {
  const areasQuery = useDiningAreas({ outletId: outletId ?? undefined, limit: 100 })
  const tablesQuery = useDiningTables({ outletId: outletId ?? undefined, limit: 100 }, { enabled })
  const showSkeleton = useDelayedLoading(areasQuery.isLoading || tablesQuery.isLoading)

  const rows = useMemo(() => {
    const areas = areasQuery.data?.data ?? []
    const tables = tablesQuery.data?.data ?? []
    return areas.map((area) => {
      const areaTables = tables.filter((t) => t.diningAreaId === area.id)
      return {
        id: area.id,
        name: area.name,
        total: areaTables.length,
        occupied: areaTables.filter((t) => t.status === "occupied").length,
        reserved: areaTables.filter((t) => t.status === "reserved").length,
        available: areaTables.filter((t) => t.status === "available").length,
      }
    })
  }, [areasQuery.data, tablesQuery.data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dining areas</CardTitle>
        <CardDescription>Occupancy by area</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : areasQuery.isError || tablesQuery.isError ? (
          <SectionError onRetry={() => { areasQuery.refetch(); tablesQuery.refetch() }} />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No dining areas configured</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className={cn("size-2 rounded-full", TABLE_STATUS_DOT.occupied)} />
                    {row.occupied}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn("size-2 rounded-full", TABLE_STATUS_DOT.reserved)} />
                    {row.reserved}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn("size-2 rounded-full", TABLE_STATUS_DOT.available)} />
                    {row.available}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {row.occupied}/{row.total}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Kitchen status                                                     */
/* ------------------------------------------------------------------ */

export function KitchenStatusSection({ outletId, enabled }: OperationalSectionProps) {
  const kdsQuery = useKdsBootstrap(enabled ? outletId : null)
  const statsQuery = useDashboardStats({ outletId, ...todayRange() }, { enabled })
  const showSkeleton = useDelayedLoading(kdsQuery.isLoading)

  const tickets = kdsQuery.data?.tickets ?? []
  const openTickets = tickets.filter((t) => t.status === "open")
  const inProgressTickets = tickets.filter((t) => t.status === "in_progress")
  const readyItems = tickets.flatMap((t) => t.items ?? []).filter((i) => i.status === "ready")
  const active = [...openTickets, ...inProgressTickets]
  const delayed = active.filter((t) => minutesSince(t.createdAt) > 20)
  const longestWaiting = active.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen</CardTitle>
        <CardDescription>Live ticket status</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : kdsQuery.isError ? (
          <SectionError onRetry={() => kdsQuery.refetch()} />
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No kitchen activity</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border bg-muted/30 py-2">
                <p className="text-lg font-semibold tabular-nums">{openTickets.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border bg-muted/30 py-2">
                <p className="text-lg font-semibold tabular-nums">{inProgressTickets.length}</p>
                <p className="text-xs text-muted-foreground">Preparing</p>
              </div>
              <div className="rounded-lg border bg-muted/30 py-2">
                <p className="text-lg font-semibold tabular-nums">{readyItems.length}</p>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
              <div className="rounded-lg border bg-muted/30 py-2">
                <p className={cn("text-lg font-semibold tabular-nums", delayed.length > 0 && "text-destructive")}>
                  {delayed.length}
                </p>
                <p className="text-xs text-muted-foreground">Delayed</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Longest waiting</span>
              {longestWaiting ? (
                <Link href={`/orders/${longestWaiting.orderId}`} className="font-medium hover:underline">
                  #{longestWaiting.order?.orderNumber ?? longestWaiting.orderId} — {elapsedLabel(longestWaiting.createdAt)}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            {statsQuery.data?.kitchenOverview.avgPrepMinutes != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg prep time</span>
                <span className="font-medium">{statsQuery.data.kitchenOverview.avgPrepMinutes.toFixed(1)} min</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Revenue + payment status                                           */
/* ------------------------------------------------------------------ */

export function RevenueSnapshotSection({ outletId, enabled }: OperationalSectionProps) {
  const todayQuery = useDashboardStats({ outletId, ...todayRange() }, { enabled })
  const yesterdayQuery = useDashboardStats({ outletId, ...yesterdayRange() }, { enabled })
  const showSkeleton = useDelayedLoading(todayQuery.isLoading)

  const change = todayQuery.data && yesterdayQuery.data
    ? pctChange(todayQuery.data.salesOverview.grandTotal, yesterdayQuery.data.salesOverview.grandTotal)
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue snapshot</CardTitle>
        <CardDescription>Today so far</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : todayQuery.isError ? (
          <SectionError onRetry={() => todayQuery.refetch()} />
        ) : (
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-semibold tracking-tight">{money(todayQuery.data?.salesOverview.grandTotal ?? 0)}</p>
            {change !== undefined && (
              <span className={cn("text-sm font-medium", change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs yesterday
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PaymentStatusSection({ outletId, enabled }: OperationalSectionProps) {
  const statsQuery = useDashboardStats({ outletId, ...todayRange() }, { enabled })
  const ordersQuery = useOrders({ outletId: outletId ?? undefined, excludeStatus: ["cancelled"], limit: 30 }, { enabled })
  const showSkeleton = useDelayedLoading(statsQuery.isLoading)

  const unpaidCount = (ordersQuery.data?.data ?? []).filter((o) => o.paymentStatus !== "paid").length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Collected today, by method</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {showSkeleton ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : statsQuery.isError ? (
          <SectionError onRetry={() => statsQuery.refetch()} />
        ) : (
          <>
            {(statsQuery.data?.paymentBreakdown.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No payments collected yet today</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {statsQuery.data?.paymentBreakdown.map((row) => (
                  <Badge key={row.method} variant="secondary" className="capitalize">
                    {row.method}: {money(row.amount)}
                  </Badge>
                ))}
              </div>
            )}
            <Link
              href="/orders"
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <ReceiptIcon className="size-4" />
                Unpaid bills
              </span>
              <span className={cn("font-semibold tabular-nums", unpaidCount > 0 && "text-destructive")}>{unpaidCount}</span>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Staff / shift status                                               */
/* ------------------------------------------------------------------ */

export function StaffShiftSection({ outletId, enabled }: OperationalSectionProps) {
  const attendanceQuery = useAttendanceToday(enabled && outletId ? outletId : undefined)
  const showSkeleton = useDelayedLoading(attendanceQuery.isLoading)
  const data = attendanceQuery.data

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff on shift</CardTitle>
        <CardDescription>Attendance today</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : attendanceQuery.isError ? (
          <SectionError onRetry={() => attendanceQuery.refetch()} />
        ) : !data || data.total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No attendance recorded today</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-muted/30 py-2">
              <p className="text-lg font-semibold tabular-nums">{data.onShift}</p>
              <p className="text-xs text-muted-foreground">On shift</p>
            </div>
            <div className="rounded-lg border bg-muted/30 py-2">
              <p className="text-lg font-semibold tabular-nums">{data.present}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div className="rounded-lg border bg-muted/30 py-2">
              <p className={cn("text-lg font-semibold tabular-nums", data.late > 0 && "text-amber-600 dark:text-amber-400")}>
                {data.late}
              </p>
              <p className="text-xs text-muted-foreground">Late</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                      */
/* ------------------------------------------------------------------ */

export interface QuickAction {
  href: string
  label: string
  icon: typeof ShoppingBagIcon
  permission: string | true
}

export const QUICK_ACTIONS: QuickAction[] = [
  { href: "/orders", label: "Orders", icon: ShoppingBagIcon, permission: "orders.view" },
  { href: "/tables", label: "Tables", icon: UtensilsCrossedIcon, permission: "dining-tables.view" },
  { href: "/notifications", label: "Notifications", icon: AlertTriangleIcon, permission: true },
  { href: "/attendance", label: "Attendance", icon: UsersIcon, permission: "attendance.view" },
  { href: "/ingredients", label: "Ingredients", icon: ChefHatIcon, permission: "ingredients.view" },
  { href: "/reports", label: "Reports", icon: ReceiptIcon, permission: "reports.view" },
]

export function QuickActionsSection({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick access</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.href} variant="outline" size="sm" render={<Link href={action.href} />}>
              <action.icon />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
