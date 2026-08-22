"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  useStartPeriodInsightsBackfill,
  type PeriodInsight,
  type PeriodInsightNp,
  type PeriodInsightType,
} from "@/hooks/use-period-insights"
import { toast } from "sonner"
import { BreakdownView, ChartsView, StatCardsView } from "./period-insight-sections"

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
  const [selectedId, setSelectedId] = useState<number | null>(null)

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
    () => rows.find((r) => r.id === selectedId) ?? rows[0],
    [rows, selectedId],
  )

  const { data: backfillStatus } = usePeriodInsightsBackfillStatus({
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  })
  const startBackfill = useStartPeriodInsightsBackfill()
  const isBackfillRunning = backfillStatus?.running ?? false
  const queryClient = useQueryClient()
  const wasBackfillRunning = useRef(false)
  useEffect(() => {
    if (wasBackfillRunning.current && !isBackfillRunning) {
      queryClient.invalidateQueries({ queryKey: queryKeys.periodInsights.all })
    }
    wasBackfillRunning.current = isBackfillRunning
  }, [isBackfillRunning, queryClient])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Summary</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selected?.periodLabel ?? "No data yet"}</span>
            <Badge variant="outline">{calendarSystem}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBackfillRunning || startBackfill.isPending}
            onClick={() => {
              startBackfill.mutate(undefined, {
                onSuccess: () => toast.info("Processing all historical orders into insights — this runs in the background."),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to start backfill"),
              })
            }}
          >
            {isBackfillRunning ? "Processing history…" : "Process all old data"}
          </Button>
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
            onValueChange={(value) => setSelectedId(Number(value))}
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
        <p className="text-sm text-muted-foreground">
          No {period} rollups yet for this outlet — they&apos;re computed nightly, so check back after the next run.
        </p>
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
