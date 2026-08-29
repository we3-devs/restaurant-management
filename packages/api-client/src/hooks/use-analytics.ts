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

export interface AnalyticsParams extends DashboardParams {
  departmentId?: number | null
  orderSource?: string
  orderType?: string
}

export interface OverviewAnalytics {
  range: { from: string; to: string }
  kpis: Record<string, number>
  trend: { date: string; orders: number; revenue: number }[]
  orderMix: { sources: { name: string; orders: number; revenue: number }[]; types: { name: string; orders: number }[] }
  paymentMix: { name: string; amount: number }[]
}
export interface SalesAnalytics extends OverviewAnalytics { revenue: Record<string, number>; compare: unknown }
export interface ProductsAnalytics { foods: { foodId: number; food: string; quantity: number; revenue: number; orders: number; averagePrice: number; share: number }[]; categories: { categoryId: number; category: string; quantity: number; revenue: number }[] }
export interface InventoryAnalytics { kpis: Record<string, number>; stock: { ingredientId: number; ingredient: string; quantity: number; value: number }[]; movement: { type: string; quantity: number }[] }
export interface CustomersAnalytics { kpis: Record<string, number>; trend: { date: string; newCount: number; returningCount: number }[] }

function analyticsParams(params: AnalyticsParams) {
  return toQueryString({ outletId: params.outletId ?? undefined, departmentId: params.departmentId ?? undefined, from: params.dateFrom, to: params.dateTo, orderSource: params.orderSource, orderType: params.orderType })
}

export function useAnalyticsOverview(params: AnalyticsParams, options?: DashboardQueryOptions) {
  return useQuery({ queryKey: ["analytics", "overview", params], queryFn: () => apiClient<OverviewAnalytics>(`/analytics/overview${analyticsParams(params)}`), staleTime: 30_000, enabled: options?.enabled })
}
export function useAnalyticsSales(params: AnalyticsParams, options?: DashboardQueryOptions) {
  return useQuery({ queryKey: ["analytics", "sales", params], queryFn: () => apiClient<SalesAnalytics>(`/analytics/sales${analyticsParams(params)}`), staleTime: 30_000, enabled: options?.enabled })
}
export function useAnalyticsProducts(params: AnalyticsParams, options?: DashboardQueryOptions) {
  return useQuery({ queryKey: ["analytics", "products", params], queryFn: () => apiClient<ProductsAnalytics>(`/analytics/products${analyticsParams(params)}`), staleTime: 30_000, enabled: options?.enabled })
}
export function useAnalyticsInventory(params: AnalyticsParams, options?: DashboardQueryOptions) {
  return useQuery({ queryKey: ["analytics", "inventory", params], queryFn: () => apiClient<InventoryAnalytics>(`/analytics/inventory${analyticsParams(params)}`), staleTime: 30_000, enabled: options?.enabled })
}
export function useAnalyticsCustomers(params: AnalyticsParams, options?: DashboardQueryOptions) {
  return useQuery({ queryKey: ["analytics", "customers", params], queryFn: () => apiClient<CustomersAnalytics>(`/analytics/customers${analyticsParams(params)}`), staleTime: 30_000, enabled: options?.enabled })
}
