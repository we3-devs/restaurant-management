"use client"

import { createContext, useContext, useMemo } from "react"
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
import { useDashboardInventoryActivity, useDashboardStats, type DashboardStats } from "@/hooks/use-dashboard"
import { useAnalyticsDashboard } from "@/hooks/use-analytics"
import { useOrders, type Order } from "@/hooks/use-orders"
import { useKdsBootstrap } from "@/hooks/use-kitchen-tickets"
import { useDiningTables } from "@/hooks/use-dining-tables"
import { useDiningAreas } from "@/hooks/use-dining-areas"
import { useTableSessions } from "@/hooks/use-table-sessions"
import { useAttendanceToday } from "@/hooks/use-attendance"
import { money } from "./chart-utils"

function isoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { createdFrom: start.toISOString(), createdTo: end.toISOString() }
}

export function todayDashboardRange() {
  const today = isoDate(new Date())
  return { dateFrom: today, dateTo: today }
}

function minutesSince(iso: string): number {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
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

interface DashboardStatsContextValue {
  today?: DashboardStats
  todayQuery: ReturnType<typeof useDashboardStats>
}

const DashboardStatsContext = createContext<DashboardStatsContextValue | null>(null)

export function DashboardStatsProvider({ outletId, enabled, children }: OperationalSectionProps & { children: React.ReactNode }) {
  const todayQuery = useDashboardStats({ outletId, ...todayDashboardRange() }, { enabled })
  return <DashboardStatsContext.Provider value={{ today: todayQuery.data, todayQuery }}>{children}</DashboardStatsContext.Provider>
}

function useDashboardStatsContext() {
  const value = useContext(DashboardStatsContext)
  if (!value) throw new Error("Dashboard sections must be rendered inside DashboardStatsProvider")
  return value
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
  const { today, todayQuery } = useDashboardStatsContext()
  const showSkeleton = useDelayedLoading(todayQuery.isLoading || !todayQuery.data)

  if (showSkeleton) return <StatGridSkeleton count={4} className="grid-cols-2 md:grid-cols-4" />
  if (todayQuery.isError) return <SectionError onRetry={() => todayQuery.refetch()} />
  if (!todayQuery.data) return null

  const data = todayQuery.data!
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        icon={UtensilsCrossedIcon}
        label="Active table sessions"
        value={String(data.activeTableSessions)}
      />
      <StatCard
        icon={ChefHatIcon}
        label="Orders in kitchen"
        value={String((data.ordersOverview.find((o) => o.status === "preparing")?.count ?? 0) + (data.ordersOverview.find((o) => o.status === "partially_ready")?.count ?? 0))}
      />
      <StatCard
        icon={WalletIcon}
        label="Today's revenue"
        value={money(data.salesOverview.grandTotal)}
        description="Today so far"
      />
      <StatCard
        icon={ClockIcon}
        label="Average ticket prep time"
        value={data.kitchenOverview.avgPrepMinutes == null ? "—" : `${data.kitchenOverview.avgPrepMinutes.toFixed(1)} min`}
        description="Today"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Live orders                                                        */
/* ------------------------------------------------------------------ */

export function LiveOrdersSection({ outletId, enabled }: OperationalSectionProps) {
  const ordersQuery = useOrders({ outletId: outletId ?? undefined, ...todayRange(), limit: 15 }, { enabled })
  const showSkeleton = useDelayedLoading(ordersQuery.isLoading)

  const orders = useMemo(() => ordersQuery.data?.data ?? [], [ordersQuery.data])
  const relevantOrders = useMemo(() => orders.slice(0, 15), [orders])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
        <CardDescription>Latest orders across the active outlet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSkeleton ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : ordersQuery.isError ? (
          <SectionError onRetry={() => ordersQuery.refetch()} />
        ) : (
          <>
            {relevantOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent orders</p>
            ) : (
              <div className="space-y-1.5">
                {relevantOrders.map((order) => {
                  return (
                    <Link
                      key={order.id}
                      href={`/dashboard/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">#{order.orderNumber}<span className="ml-2 text-xs font-normal text-muted-foreground">{order.orderType.replaceAll("_", " ")}</span></span>
                      <span className="shrink-0 text-muted-foreground">{order.tableName ?? "No Table"}</span>
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
    // This widget needs a complete unpaid-bill count, not just the first page
    // of the newest orders. Keep the request within the API's maximum page size.
    { outletId: outletId ?? undefined, ...todayRange(), excludeStatus: ["cancelled"], limit: 500 },
    { enabled: enabled && canViewOrders },
  )
  const kdsQuery = useKdsBootstrap(enabled && canViewKitchen ? outletId : null)
  const { todayQuery: statsQuery } = useDashboardStatsContext()
  const inventoryQuery = useDashboardInventoryActivity({ outletId }, { enabled: enabled && canViewDashboardStats })

  const isLoading =
    (canViewOrders && ordersQuery.isLoading) || (canViewKitchen && kdsQuery.isLoading) || (canViewDashboardStats && (statsQuery.isLoading || inventoryQuery.isLoading))
  const showSkeleton = useDelayedLoading(isLoading)

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = []
    const orders = ordersQuery.data?.data ?? []

    const lowStock = inventoryQuery.data?.lowStockItems ?? []
    if (lowStock.length > 0) {
      result.push({
        id: "low-stock",
        severity: "warning",
        label: `${lowStock.length} ingredient${lowStock.length > 1 ? "s" : ""} at or below reorder level`,
        href: "/dashboard/ingredients",
      })
    }

    const recalled = (kdsQuery.data?.tickets ?? []).filter((ticket) => ticket.recallCount > 0)
    if (recalled.length > 0) {
      result.push({
        id: "recalled-tickets",
        severity: "critical",
        label: `${recalled.length} recalled kitchen ticket${recalled.length > 1 ? "s" : ""}`,
        href: "/dashboard/kitchen",
      })
    }

    const pendingApproval = orders.filter((o) => o.approvalStatus === "pending")
    if (pendingApproval.length > 0) {
      result.push({
        id: "pending-approval",
        severity: "warning",
        label: `${pendingApproval.length} order${pendingApproval.length > 1 ? "s" : ""} pending approval`,
        href: "/dashboard/orders",
      })
    }

    const unpaidCompleted = orders.filter((o) => o.status === "completed" && ["unpaid", "partial"].includes(o.paymentStatus))
    if (unpaidCompleted.length > 0) {
      result.push({
        id: "unpaid-completed",
        severity: "critical",
        label: `${unpaidCompleted.length} completed order${unpaidCompleted.length > 1 ? "s" : ""} unpaid`,
        href: "/dashboard/invoices",
      })
    }

    return result
  }, [ordersQuery.data, kdsQuery.data, inventoryQuery.data, statsQuery.data])

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
          <div className="flex gap-3 overflow-x-auto pb-1">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex min-w-64 shrink-0 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm transition-colors hover:opacity-80",
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
            <Button variant="outline" size="sm" className="w-full" render={<Link href="/dashboard/tables" />}>
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
  const areasQuery = useDiningAreas({ outletId: outletId ?? undefined, limit: 100 }, { enabled })
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
        tables: areaTables,
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold tracking-tight">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.occupied} of {row.total} tables occupied</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    {row.total ? Math.round((row.occupied / row.total) * 100) : 0}%
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${row.total ? (row.occupied / row.total) * 100 : 0}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {row.tables.map((table) => (
                    <Link
                      key={table.id}
                      href={`/dashboard/tables/${table.id}`}
                      title={`${table.name} · ${table.status}`}
                      className={cn(
                        "flex min-h-16 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-1.5 py-2 text-center text-xs transition-all hover:-translate-y-0.5 hover:shadow-sm",
                        table.status === "occupied" && "border-destructive/30 bg-destructive/10 text-destructive",
                        table.status === "reserved" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        table.status === "available" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        !["occupied", "reserved", "available"].includes(table.status) && "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <span className="w-full break-words font-semibold leading-tight">{table.name}</span>
                      <span className="mt-1 rounded-full bg-background/50 px-1.5 py-0.5 text-[10px] capitalize leading-none opacity-80">{table.status}</span>
                    </Link>
                  ))}
                </div>
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
  const showSkeleton = useDelayedLoading(kdsQuery.isLoading)

  const tickets = kdsQuery.data?.tickets ?? []
  const openTickets = tickets.filter((t) => t.status === "open")
  const inProgressTickets = tickets.filter((t) => t.status === "in_progress")
  const active = [...openTickets, ...inProgressTickets]
  const queue = active.slice().sort((a, b) => new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime()).slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen queue</CardTitle>
        <CardDescription>Open and preparing tickets, oldest first</CardDescription>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : kdsQuery.isError ? (
          <SectionError onRetry={() => kdsQuery.refetch()} />
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No kitchen activity</p>
        ) : (
          <div className="space-y-1.5">
            {queue.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/orders/${ticket.orderId}`} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors hover:border-border hover:bg-muted/50">
                <span className={cn("size-2 shrink-0 rounded-full", ticket.status === "in_progress" ? "bg-amber-500" : "bg-sky-500")} />
                <span className="min-w-0 flex-1 truncate font-medium">#{ticket.order?.orderNumber ?? ticket.orderId}</span>
                <span className="text-xs capitalize text-muted-foreground">{ticket.status.replaceAll("_", " ")}</span>
                {ticket.recallCount > 0 && <Badge variant="destructive">recalled</Badge>}
                <span className="w-14 text-right text-xs text-muted-foreground">{elapsedLabel(ticket.startedAt ?? ticket.createdAt)}</span>
              </Link>
            ))}
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
  const { today, todayQuery } = useDashboardStatsContext()
  const showSkeleton = useDelayedLoading(todayQuery.isLoading)
  const change: number | undefined = undefined

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
            <p className="text-3xl font-semibold tracking-tight">{money(today?.salesOverview.grandTotal ?? 0)}</p>
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
  const { today: stats, todayQuery: statsQuery } = useDashboardStatsContext()
  const ordersQuery = useOrders({ outletId: outletId ?? undefined, ...todayRange(), excludeStatus: ["cancelled"], limit: 500 }, { enabled })
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
            {(stats?.paymentBreakdown.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No payments collected yet today</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats?.paymentBreakdown.map((row) => (
                  <Badge key={row.method} variant="secondary" className="capitalize">
                    {row.method}: {money(row.amount)}
                  </Badge>
                ))}
              </div>
            )}
            <Link
              href="/dashboard/orders"
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
  const attendanceQuery = useAttendanceToday(enabled && outletId ? outletId : undefined, { enabled })
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
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBagIcon, permission: "orders.view" },
  { href: "/dashboard/tables", label: "Tables", icon: UtensilsCrossedIcon, permission: "dining-tables.view" },
  { href: "/dashboard/notifications", label: "Notifications", icon: AlertTriangleIcon, permission: true },
  { href: "/dashboard/attendance", label: "Attendance", icon: UsersIcon, permission: "attendance.view" },
  { href: "/dashboard/ingredients", label: "Ingredients", icon: ChefHatIcon, permission: "ingredients.view" },
  { href: "/dashboard/reports", label: "Reports", icon: ReceiptIcon, permission: "reports.view" },
]

export function DomainTodaySection({ outletId, enabled }: OperationalSectionProps) {
  const query = useAnalyticsDashboard({ outletId, dateFrom: todayDashboardRange().dateFrom, dateTo: todayDashboardRange().dateTo }, { enabled })
  if (query.isLoading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading today&apos;s domain activity…</CardContent></Card>
  if (query.isError) return <Card><CardContent><SectionError onRetry={() => void query.refetch()} /></CardContent></Card>
  if (!query.data) return null
  return <Card><CardHeader><CardTitle>Today&apos;s domain activity</CardTitle><CardDescription>Real records from purchasing, reservations, staff, loyalty, and system activity</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(query.data.domains).map(([key, report]) => <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm"><span className="truncate capitalize">{key.replaceAll("-", " ")}</span><span className="font-semibold tabular-nums">{report.meta.total.toLocaleString()}</span></div>)}</CardContent></Card>
}

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
