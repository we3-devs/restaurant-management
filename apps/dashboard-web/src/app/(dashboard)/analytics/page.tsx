"use client"

import { useMemo, useState } from "react"

import { DateRangeFilter, type DateRange } from "@/components/date-range-filter"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatGridSkeleton } from "@/components/ui/skeletons"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useDashboardAnalytics } from "@/hooks/use-analytics"
import { useDashboardBreakdown, useDashboardInventoryActivity } from "@/hooks/use-dashboard"

import {
  buildInsights,
  CustomerAnalyticsCards,
  DiscountRefundCard,
  ErrorState,
  IngredientConsumptionCard,
  InsightsStrip,
  OrderStatusCard,
  PaymentMethodCard,
  PeakHoursCard,
  PrepPerformanceCard,
  ProfitUnavailableCard,
  SalesByCategoryCard,
  SectionLoading,
} from "./analytics-sections"

type Preset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
]

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeForPreset(preset: Preset): DateRange {
  const now = new Date()
  const today = toIsoDate(now)
  switch (preset) {
    case "today":
      return { dateFrom: today, dateTo: today }
    case "yesterday": {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { dateFrom: toIsoDate(y), dateTo: toIsoDate(y) }
    }
    case "last7": {
      const from = new Date(now)
      from.setDate(from.getDate() - 6)
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    case "last30": {
      const from = new Date(now)
      from.setDate(from.getDate() - 29)
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    default:
      return { dateFrom: today, dateTo: today }
  }
}

export default function AnalyticsPage() {
  useCurrentUser()
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const [preset, setPreset] = useState<Preset>("last30")
  const [customRange, setCustomRange] = useState<DateRange>(() => rangeForPreset("last30"))

  const range = preset === "custom" ? customRange : rangeForPreset(preset)
  const dataEnabled = !isLoadingOutlets

  const analyticsQuery = useDashboardAnalytics(
    { outletId, dateFrom: range.dateFrom, dateTo: range.dateTo },
    { enabled: dataEnabled },
  )
  const inventoryQuery = useDashboardInventoryActivity(
    { outletId, dateFrom: range.dateFrom, dateTo: range.dateTo },
    { enabled: dataEnabled },
  )
  const breakdownQuery = useDashboardBreakdown(
    { outletId, dateFrom: range.dateFrom, dateTo: range.dateTo },
    { enabled: dataEnabled },
  )

  const insights = useMemo(() => {
    if (!analyticsQuery.data) return []
    return buildInsights(analyticsQuery.data.current, analyticsQuery.data.previous)
  }, [analyticsQuery.data])

  const isLoading = analyticsQuery.isLoading || !dataEnabled
  const isError = analyticsQuery.isError

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {range.dateFrom} — {range.dateTo}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44 space-y-1.5">
            <label className="text-sm font-medium">Range</label>
            <Select value={preset} onValueChange={(v) => v && setPreset(v as Preset)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && <DateRangeFilter value={customRange} onChange={setCustomRange} />}
        </div>
      </div>

      {isLoading ? (
        <StatGridSkeleton count={4} />
      ) : isError ? (
        <ErrorState message="Failed to load analytics for this range. Try again shortly." />
      ) : !analyticsQuery.data ? (
        <ErrorState message="No analytics data available." />
      ) : (
        <>
          <InsightsStrip insights={insights} />

          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PeakHoursCard data={analyticsQuery.data.current.peakHours} />
                <SalesByCategoryCard data={analyticsQuery.data.current.salesByCategory} />
              </div>
            </TabsContent>

            <TabsContent value="finance">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PaymentMethodCard data={breakdownQuery.data?.paymentBreakdown ?? []} />
                <DiscountRefundCard data={analyticsQuery.data.current.discountRefund} />
                <ProfitUnavailableCard />
              </div>
            </TabsContent>

            <TabsContent value="operations">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <OrderStatusCard data={analyticsQuery.data.current.orderStatus} />
                <PrepPerformanceCard data={analyticsQuery.data.current.prepPerformance} />
              </div>
            </TabsContent>

            <TabsContent value="inventory">
              {inventoryQuery.isLoading ? (
                <SectionLoading />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <IngredientConsumptionCard
                    data={analyticsQuery.data.current.ingredientConsumption}
                    lowStockItems={inventoryQuery.data?.lowStockItems ?? []}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="customers">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CustomerAnalyticsCards data={analyticsQuery.data.current.customerAnalytics} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

