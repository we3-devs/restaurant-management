"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { BarChart3Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { useSettingsCategory, type BusinessSettings } from "@/hooks/use-settings"
import { queryKeys } from "@/lib/query-keys"
import {
  usePeriodInsights,
  usePeriodInsightsBackfillStatus,
  usePeriodInsightsNp,
  type PeriodInsight,
  type PeriodInsightNp,
  type PeriodInsightType,
} from "@/hooks/use-period-insights"
import { BreakdownView, ChartsView, StatCardsView } from "./period-insight-sections"
import { usePageTitle } from "@rms/ui/use-page-title"

type Period = PeriodInsightType

const PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

const HISTORY_LIMIT = 30

export default function SummaryPage() {
  useCurrentUser()
  const { outletId, isLoadingOutlets } = useActiveOutlet()
  const [period, setPeriod] = useState<Period>("daily")
  // `id` comes back over JSON as a string (Postgres bigint), so compare as strings.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: businessSettings, isLoading: isLoadingSettings } =
    useSettingsCategory<BusinessSettings>("business")
  // Default to AD while the setting is still loading, rather than flashing BS then AD.
  const calendarSystem = businessSettings?.calendarSystem ?? "AD"
  const dataEnabled = !isLoadingOutlets && !isLoadingSettings

  const adQuery = usePeriodInsights(
    { outletId, periodType: period, limit: HISTORY_LIMIT },
    { enabled: dataEnabled && calendarSystem === "AD" },
  )
  const npQuery = usePeriodInsightsNp(
    { outletId, periodType: period, limit: HISTORY_LIMIT },
    { enabled: dataEnabled && calendarSystem === "BS" },
  )

  const rows: (PeriodInsight | PeriodInsightNp)[] = useMemo(
    () => (calendarSystem === "BS" ? npQuery.data ?? [] : adQuery.data ?? []),
    [calendarSystem, npQuery.data, adQuery.data],
  )
  const isLoading = calendarSystem === "BS" ? npQuery.isLoading : adQuery.isLoading
  const showSkeleton = useDelayedLoading(isLoading || (dataEnabled && !businessSettings))

  // Rows are most-recent-first. `selectedId` only tracks an explicit user
  // pick — falling back to the latest row here (rather than syncing it via
  // an effect) means switching period/calendar/outlet just naturally shows
  // the newest row of the new set without any extra state to keep in sync.
  const selected = useMemo(
    () => rows.find((r) => String(r.id) === selectedId) ?? rows[0],
    [rows, selectedId],
  )

  const { data: backfillStatus } = usePeriodInsightsBackfillStatus({
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  })
  const isBackfillRunning = backfillStatus?.running ?? false
  const queryClient = useQueryClient()
  const wasBackfillRunning = useRef(false)
  useEffect(() => {
    if (wasBackfillRunning.current && !isBackfillRunning) {
      queryClient.invalidateQueries({ queryKey: queryKeys.periodInsights.all })
    }
    wasBackfillRunning.current = isBackfillRunning
  }, [isBackfillRunning, queryClient])

  usePageTitle("Period Summary")

  return (
    <div className="page-shell space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Period Summary</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selected?.periodLabel ?? "No data yet"}</span>
            <Badge variant="outline">{calendarSystem}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                type="button"
                size="sm"
                variant={period === p.value ? "default" : "ghost"}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Select
            value={selected ? String(selected.id) : undefined}
            onValueChange={(value) => setSelectedId(value)}
            disabled={rows.length === 0}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a period" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {row.periodLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSkeleton ? (
        <StatGridSkeleton count={6} className="grid-cols-2 md:grid-cols-4" />
      ) : !selected ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3Icon className="size-8 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No {period} rollups yet</p>
              <p className="text-sm text-muted-foreground">
                {isBackfillRunning
                  ? "Processing historical orders into insights — this can take a few minutes."
                  : "Rollups are computed nightly for this outlet. A superadmin can process past orders now from Organization → Outlets instead of waiting for tonight's run."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatCardsView payload={selected.payload} />
          <ChartsView payload={selected.payload} />
          <BreakdownView payload={selected.payload} />
        </>
      )}
    </div>
  )
}
