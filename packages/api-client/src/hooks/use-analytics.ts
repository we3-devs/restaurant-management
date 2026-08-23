import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString } from "../types"
import { queryKeys } from "../query-keys"
import type { DashboardParams, DashboardQueryOptions } from "./use-dashboard"

export interface PeakHour {
  hour: number
  orderCount: number
  revenue: number
}

export interface SalesByCategory {
  categoryId: number
  categoryName: string
  revenue: number
  orderCount: number
}

export interface DiscountRefund {
  totalDiscount: number
  discountedOrderCount: number
  avgDiscount: number
  totalRefunded: number
  refundCount: number
  refundRate: number
  trend: { date: string; discountAmount: number }[]
}

export interface OrderStatusAnalytic {
  status: string
  count: number
  percentage: number
}

export interface PrepPerformance {
  expectedMinutes: number
  avgMinutes: number | null
  fastestMinutes: number | null
  slowestMinutes: number | null
  totalTickets: number
  onTimeCount: number
  delayedCount: number
  trend: { date: string; avgMinutes: number }[]
}

export interface IngredientConsumptionRow {
  ingredientId: number
  ingredientName: string
  totalConsumed: number
  unitName: string | null
}

export interface IngredientConsumptionAnalytics {
  mostConsumed: IngredientConsumptionRow[]
  leastConsumed: IngredientConsumptionRow[]
}

export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  avgSpend: number
  avgOrdersPerCustomer: number
  trend: { date: string; newCount: number; returningCount: number }[]
}

export interface DashboardAnalytics {
  peakHours: PeakHour[]
  salesByCategory: SalesByCategory[]
  discountRefund: DiscountRefund
  orderStatus: OrderStatusAnalytic[]
  prepPerformance: PrepPerformance
  ingredientConsumption: IngredientConsumptionAnalytics
  customerAnalytics: CustomerAnalytics
}

export interface DashboardAnalyticsResponse {
  current: DashboardAnalytics
  previous: DashboardAnalytics
}

function analyticsQueryString(params: DashboardParams): string {
  const { outletId, ...rest } = params
  return toQueryString({ outletId: outletId ?? undefined, ...rest })
}

/**
 * Analytics for the `/analytics` page's Sales/Finance/Operations/Inventory/
 * Customers tabs. Returns both the requested range (`current`) and the
 * equivalent immediately-preceding range (`previous`) so the page's
 * insights strip can compute real % changes client-side.
 */
export function useDashboardAnalytics(params: DashboardParams, options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.analytics(params),
    queryFn: () => apiClient<DashboardAnalyticsResponse>(`/dashboard/analytics${analyticsQueryString(params)}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}
