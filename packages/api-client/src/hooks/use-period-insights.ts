import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString } from "../types"
import { queryKeys } from "../query-keys"

export type PeriodInsightType = "daily" | "weekly" | "monthly"

export interface PeriodInsightPayload {
  salesOverview: { orderCount: number; grandTotal: number; avgOrderValue: number }
  ordersOverview: { status: string; count: number }[]
  paymentBreakdown: { method: string; amount: number }[]
  bestSellingFoods: { foodId: number; foodName: string; quantitySold: number; revenue: number }[]
  wastageSummary: { reason: string; quantity: number; totalCost: number }[]
  kitchenOverview: { openTickets: number; inProgressTickets: number; avgPrepMinutes: number | null }
  revenueTrend: { date: string; orderCount: number; grandTotal: number }[]
}

/** AD (Gregorian) calendar rollup — see backend `period_insights` table. */
export interface PeriodInsight {
  id: number
  outletId: number
  periodType: PeriodInsightType
  periodStart: string
  periodEnd: string
  periodLabel: string
  payload: PeriodInsightPayload
  computedAt: string
}

/** BS (Bikram Sambat) calendar rollup — see backend `period_insights_np` table. */
export interface PeriodInsightNp {
  id: number
  outletId: number
  periodType: PeriodInsightType
  periodStartBs: string
  periodEndBs: string
  periodStartAd: string
  periodEndAd: string
  periodLabel: string
  payload: PeriodInsightPayload
  computedAt: string
}

export interface PeriodInsightsParams {
  outletId?: number | null
  periodType: PeriodInsightType
  limit?: number
}

export interface PeriodInsightsQueryOptions {
  enabled?: boolean
}

function periodInsightsQueryString(params: PeriodInsightsParams): string {
  const { outletId, ...rest } = params
  return toQueryString({ outletId: outletId ?? undefined, ...rest })
}

/** Persisted daily/weekly/monthly rollups on AD calendar boundaries, most recent period first. */
export function usePeriodInsights(params: PeriodInsightsParams, options?: PeriodInsightsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.periodInsights.list(params),
    queryFn: () => apiClient<PeriodInsight[]>(`/period-insights${periodInsightsQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

/** Persisted daily/weekly/monthly rollups on real Bikram Sambat calendar boundaries, most recent period first. */
export function usePeriodInsightsNp(params: PeriodInsightsParams, options?: PeriodInsightsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.periodInsights.listNp(params),
    queryFn: () => apiClient<PeriodInsightNp[]>(`/period-insights/np${periodInsightsQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

/** Manually re-runs the AD rollup for the current period boundaries. */
export function useRebuildPeriodInsights() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<void>("/period-insights/rebuild", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.periodInsights.all }),
  })
}

/** Manually re-runs the BS rollup for the current period boundaries. */
export function useRebuildPeriodInsightsNp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<void>("/period-insights/np/rebuild", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.periodInsights.all }),
  })
}

export interface PeriodInsightsBackfillStatus {
  running: boolean
  since: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

/**
 * One-time "process all old data" backfill: rolls up every daily/weekly/
 * monthly window since the earliest order ever placed, on both AD and BS
 * calendars. Runs in the background on the server — poll
 * `usePeriodInsightsBackfillStatus` for progress. After it finishes once,
 * the nightly scheduler keeps insights current automatically.
 */
export function useStartPeriodInsightsBackfill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<PeriodInsightsBackfillStatus>("/period-insights/backfill", { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.periodInsights.backfillStatus() }),
  })
}

/** Status of the most recent (or currently running) full-history backfill. Pass `refetchInterval` while running to poll. */
export function usePeriodInsightsBackfillStatus(options?: {
  refetchInterval?: number | false | ((query: { state: { data?: PeriodInsightsBackfillStatus } }) => number | false)
}) {
  return useQuery({
    queryKey: queryKeys.periodInsights.backfillStatus(),
    queryFn: () => apiClient<PeriodInsightsBackfillStatus>("/period-insights/backfill"),
    refetchInterval: options?.refetchInterval,
  })
}
