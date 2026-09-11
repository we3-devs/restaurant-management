"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Clock3, FileText, Flame, LayoutGrid, Package, ShoppingBag, Sparkles, Users, WalletCards, type LucideIcon } from "lucide-react"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { useDashboardCharts, useDashboardStats } from "@rms/api-client/hooks/use-dashboard"
import { useAnalyticsDashboard } from "@rms/api-client/hooks/use-analytics"
import { useOrders } from "@rms/api-client/hooks/use-orders"
import { useDiningTables } from "@rms/api-client/hooks/use-dining-tables"
import { useKdsBootstrap } from "@rms/api-client/hooks/use-kitchen-tickets"

type Stat = { label: string; value: string; icon: LucideIcon; direction?: "up" | "down" }
const activityLabels: [string, LucideIcon][] = [["purchase-orders", Package], ["goods-receiving", Flame], ["purchase-returns", WalletCards], ["supplier-payments", CircleDollarSign], ["reservations", LayoutGrid], ["shifts", Users], ["loyalty-transactions", Sparkles], ["audit-logs", FileText]]

function useClock() { const [now, setNow] = useState(() => new Date()); useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, []); return now }
function greeting(hour: number) { if (hour < 12) return "Good morning"; if (hour < 17) return "Good afternoon"; return "Good evening" }
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) }
function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`dash-panel ${className}`}>{children}</section> }
function Heading({ title, subtitle, action = "View All" }: { title: string; subtitle?: string; action?: string }) { return <div className="dash-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="dash-link">{action} <span>→</span></button>}</div> }
function Status({ children }: { children: string }) { return <span className={`dash-status ${children.toLowerCase()}`}>{children.replaceAll("_", " ")}</span> }
function ErrorState({ retry }: { retry: () => void }) { return <div className="dash-error"><strong>Couldn&apos;t load dashboard data.</strong><button onClick={retry}>Retry</button></div> }
function LoadingDashboard() {
  return <div className="dashboard-page page-shell dash-loading-page">
    <div className="dash-skeleton dash-skeleton-heading" />
    <div className="dash-stat-grid">{Array.from({ length: 4 }, (_, i) => <div className="dash-stat dash-skeleton-stat" key={i}><i /><span /><b /><small /></div>)}</div>
    <div className="dash-main-grid"><Panel><div className="dash-skeleton dash-skeleton-chart" /></Panel><Panel><div className="dash-skeleton dash-skeleton-orders" /></Panel></div>
    <Panel className="items-panel"><div className="dash-skeleton dash-skeleton-items" /></Panel>
    <div className="dash-main-grid lower-grid"><Panel><div className="dash-skeleton dash-skeleton-lower" /></Panel><Panel><div className="dash-skeleton dash-skeleton-lower" /></Panel></div>
    <Panel className="activity-panel"><div className="dash-skeleton dash-skeleton-activity" /></Panel>
  </div>
}

export default function DashboardPage() {
  const user = useCurrentUser(); const now = useClock(); usePageTitle("Dashboard")
  const { outletId, isLoadingOutlets } = useActiveOutlet(); const enabled = !isLoadingOutlets && outletId !== null
  const range = useMemo(() => ({ outletId: outletId ?? undefined, dateFrom: today(), dateTo: today() }), [outletId, now.toDateString()])
  const stats = useDashboardStats(range, { enabled }); const charts = useDashboardCharts(range, { enabled })
  const orders = useOrders({ outletId: outletId ?? undefined, createdFrom: `${range.dateFrom}T00:00:00`, createdTo: `${range.dateTo}T23:59:59`, excludeStatus: ["cancelled"], limit: 10 }, { enabled })
  const tables = useDiningTables({ outletId: outletId ?? undefined, limit: 100 }, { enabled })
  const kitchen = useKdsBootstrap(outletId)
  const analytics = useAnalyticsDashboard(range, { enabled })
  const queries = [stats, charts, orders, tables, kitchen, analytics]
  const coreQueries = [stats, charts, orders, tables]
  const retry = () => queries.forEach((query) => void query.refetch())
  if (isLoadingOutlets || coreQueries.some((query) => query.isLoading)) return <LoadingDashboard />
  if (coreQueries.some((query) => query.isError) || !stats.data || !charts.data || !orders.data || !tables.data) return <div className="dashboard-page"><ErrorState retry={retry} /></div>

  const statData: Stat[] = [
    { label: "Total Orders", value: String(stats.data.salesOverview.orderCount), icon: ShoppingBag, direction: "up" },
    { label: "Total Revenue", value: money(stats.data.salesOverview.grandTotal), icon: CircleDollarSign, direction: "up" },
    { label: "Active Tables", value: `${stats.data.activeTableSessions} / ${tables.data.data.length}`, icon: LayoutGrid, direction: "up" },
    { label: "Pending Orders", value: String(stats.data.ordersOverview.filter((row) => ["pending", "accepted", "preparing", "partially_ready"].includes(row.status)).reduce((sum, row) => sum + row.count, 0)), icon: Clock3, direction: "down" },
  ]
  const trend = charts.data.revenueTrend; const maxRevenue = Math.max(...trend.map((point) => point.grandTotal), 0)
  const points = maxRevenue > 0 ? trend.map((point, index) => `${trend.length === 1 ? 400 : (index / (trend.length - 1)) * 800},${190 - (point.grandTotal / maxRevenue) * 160}`).join(" ") : ""
  const tableCounts = tables.data.data.reduce<Record<string, number>>((acc, table) => { acc[table.status] = (acc[table.status] ?? 0) + 1; return acc }, {})
  const tableTotal = tables.data.data.length
  const occupied = tableCounts.occupied ?? stats.data.activeTableSessions
  const queue = kitchen.data?.tickets.slice(0, 5) ?? []
  const bestSelling = charts.data.bestSellingFoods.slice(0, 4)
  return <div className="dashboard-page page-shell">
    <div className="dash-welcome"><div><h1>{greeting(now.getHours())}, {user.name}</h1><p>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div></div>
    <div className="dash-stat-grid">{statData.map(({ label, value, icon: Icon, direction }) => <div className="dash-stat" key={label}><div className="dash-stat-icon"><Icon /></div><span>{label}</span><strong>{value}</strong><small className={direction === "down" ? "negative" : "positive"}>{direction === "down" ? <ArrowDownRight /> : <ArrowUpRight />} Today</small></div>)}</div>
    <div className="dash-main-grid">
      <Panel className="sales-panel"><Heading title="Sales Overview" subtitle={trend.length ? `${trend.length} revenue data point${trend.length === 1 ? "" : "s"}` : "No sales data for today"} /><div className="chart-wrap"><div className="chart-y"><span>{money(maxRevenue)}</span><span>{money(maxRevenue * .75)}</span><span>{money(maxRevenue * .5)}</span><span>{money(maxRevenue * .25)}</span><span>$0</span></div><svg viewBox="0 0 800 220" preserveAspectRatio="none" aria-label="Sales overview chart"><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5b51b" stopOpacity=".42" /><stop offset="1" stopColor="#f5b51b" stopOpacity=".03" /></linearGradient></defs>{points && <><polyline points={`${points} 800,220 0,220`} fill="url(#salesFill)" /><polyline points={points} fill="none" stroke="#f5b51b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}</svg><div className="chart-x">{trend.map((point) => <span key={point.date}>{point.date}</span>)}</div>{!trend.length && <span className="dash-empty-chart">No sales data for today</span>}</div></Panel>
      <Panel><Heading title="Recent Orders" subtitle="Latest orders across the active outlet" /><div className="dash-table"><div className="dash-table-head"><span>Table #</span><span>Customer</span><span>Time</span><span>Status</span></div>{orders.data.data.length ? orders.data.data.map((order) => <div className="dash-table-row" key={order.id}><span>{order.tableName ?? order.orderNumber}</span><span>{order.customerName ?? "—"}</span><span>{time(order.createdAt)}</span><Status>{order.status}</Status></div>) : <div className="dash-empty-row">No orders for today</div>}</div></Panel>
    </div>
    <Panel className="items-panel"><Heading title="Top Selling Items" action="" />{bestSelling.length ? <div className="item-grid">{bestSelling.map((item) => <Link href={`/dashboard/foods/${item.foodId}`} className="selling-item" key={item.foodId}><div className="item-emoji">🍽️</div><div><strong>{item.foodName}</strong><small>{item.quantitySold} sold · {money(item.revenue)}</small></div></Link>)}</div> : <div className="dash-empty-row">No items sold today</div>}</Panel>
    <div className="dash-main-grid lower-grid"><Panel><Heading title="Table Occupancy" subtitle="Live status of tables in the restaurant" /><div className="occupancy"><div className="donut" style={{ background: `conic-gradient(#f5b51b 0 ${tableTotal ? (occupied / tableTotal) * 100 : 0}%,#25354e 0)` }}><strong>{tableTotal ? Math.round((occupied / tableTotal) * 100) : 0}%</strong><span>Occupied</span></div><div className="legend"><span><i className="green" />Available <b>{tableCounts.available ?? 0}</b></span><span><i className="gold" />Occupied <b>{occupied}</b></span><span><i className="blue" />Cleaning <b>{tableCounts.cleaning ?? 0}</b></span><span><i className="red" />Reserved <b>{tableCounts.reserved ?? 0}</b></span></div><div className="table-grid">{tables.data.data.map((table) => <span key={table.id} className={table.status}>{table.name}<small>{table.status}</small></span>)}</div></div></Panel><Panel><Heading title="Kitchen Queue" subtitle="Open and preparing tickets, oldest first" /><div className="queue">{kitchen.isError ? <div className="dash-empty-row">Couldn&apos;t load kitchen queue. <button className="dash-inline-retry" onClick={() => void kitchen.refetch()}>Retry</button></div> : kitchen.isLoading ? <div className="dash-skeleton dash-skeleton-queue" /> : queue.length ? queue.map((ticket) => { const item = ticket.items?.[0]?.orderItem?.food?.name ?? `Order ${ticket.order?.orderNumber ?? ticket.orderId}`; const table = ticket.order?.tableSession?.diningTable?.name ?? "No table"; return <div className="queue-row" key={ticket.id}><i className={ticket.status === "in_progress" ? "gold-dot" : "green-dot"} /><strong>{table}</strong><span>—</span><span>{item}</span><time>{time(ticket.createdAt)}</time><Status>{ticket.status === "in_progress" ? "Preparing" : "Open"}</Status></div> }) : <div className="dash-empty-row">No kitchen tickets for today</div>}</div></Panel></div>
    <Panel className="activity-panel"><Heading title="Today&apos;s domain activity" subtitle="Real records from purchasing, reservations, staff, loyalty and system activity" /><div className="activity-grid">{analytics.isError ? <div className="dash-empty-row">Couldn&apos;t load domain activity. <button className="dash-inline-retry" onClick={() => void analytics.refetch()}>Retry</button></div> : analytics.isLoading ? <div className="dash-skeleton dash-skeleton-activity" /> : activityLabels.map(([key, Icon]) => <div className="activity" key={key}><div className="activity-icon"><Icon /></div><span>{key.replaceAll("-", " ")}<b>{analytics.data?.domains[key]?.meta.total ?? 0}</b></span></div>)}</div></Panel>
  </div>
}
