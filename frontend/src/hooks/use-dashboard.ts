import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { AppNotification } from "./use-notifications"

export interface DashboardParams {
  outletId?: number | null
  dateFrom?: string
  dateTo?: string
}

export interface DashboardStats {
  salesOverview: { orderCount: number; grandTotal: number; avgOrderValue: number }
  activeTableSessions: number
  ordersOverview: { status: string; count: number }[]
  kitchenOverview: { openTickets: number; inProgressTickets: number; avgPrepMinutes: number | null }
  wastageSummary: { reason: string; quantity: number; totalCost: number }[]
  paymentBreakdown: { method: string; amount: number }[]
  inventoryOverview: { lowStockCount: number; outOfStockCount: number }
}

export interface DashboardCharts {
  revenueTrend: { date: string; orderCount: number; grandTotal: number }[]
  bestSellingFoods: { foodId: number; foodName: string; quantitySold: number; revenue: number }[]
}

export interface DashboardBreakdown {
  ordersOverview: { status: string; count: number }[]
  reservationsSummary: { status: string; count: number }[]
  paymentBreakdown: { method: string; amount: number }[]
}

export interface DashboardInventoryActivity {
  lowStockItems: { ingredientId: number; ingredientName: string; quantity: number; reorderLevel: number }[]
  recentActivity: AppNotification[]
}

function dashboardQueryString(params: DashboardParams): string {
  const { outletId, ...rest } = params
  return toQueryString({ outletId: outletId ?? undefined, ...rest })
}

export interface DashboardQueryOptions {
  /**
   * Pass `!isLoadingOutlets` from useActiveOutlet() so this doesn't fire
   * once with outletId undefined (an unscoped all-outlets aggregate) and
   * again once the real outlet resolves — defaults to enabled for callers
   * that don't care (e.g. already gating outletId upstream).
   */
  enabled?: boolean
}

export function useDashboardStats(params: DashboardParams, options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(params),
    queryFn: () => apiClient<DashboardStats>(`/dashboard/stats${dashboardQueryString(params)}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

export function useDashboardCharts(params: DashboardParams, options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.charts(params),
    queryFn: () => apiClient<DashboardCharts>(`/dashboard/charts${dashboardQueryString(params)}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

export function useDashboardBreakdown(params: DashboardParams, options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.breakdown(params),
    queryFn: () => apiClient<DashboardBreakdown>(`/dashboard/breakdown${dashboardQueryString(params)}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

export function useDashboardInventoryActivity(params: DashboardParams, options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.inventoryActivity(params),
    queryFn: () =>
      apiClient<DashboardInventoryActivity>(`/dashboard/inventory-activity${dashboardQueryString(params)}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}
