import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { AppNotification } from "./use-notifications"

export interface DashboardSummary {
  salesOverview: { orderCount: number; grandTotal: number; avgOrderValue: number }
  revenueTrend: { date: string; orderCount: number; grandTotal: number }[]
  ordersOverview: { status: string; count: number }[]
  activeTableSessions: number
  reservationsSummary: { status: string; count: number }[]
  kitchenOverview: { openTickets: number; inProgressTickets: number; avgPrepMinutes: number | null }
  inventoryOverview: {
    totalIngredients: number
    lowStockCount: number
    outOfStockCount: number
    lowStockItems: { ingredientId: number; ingredientName: string; quantity: number; reorderLevel: number }[]
  }
  wastageSummary: { reason: string; quantity: number; totalCost: number }[]
  paymentBreakdown: { method: string; amount: number }[]
  bestSellingFoods: { foodId: number; foodName: string; quantitySold: number; revenue: number }[]
  recentActivity: AppNotification[]
}

export interface DashboardParams {
  outletId?: number | null
  dateFrom?: string
  dateTo?: string
}

export function useDashboardSummary(params: DashboardParams) {
  const { outletId, ...rest } = params
  return useQuery({
    queryKey: queryKeys.dashboard.summary(params),
    queryFn: () =>
      apiClient<DashboardSummary>(
        `/dashboard/summary${toQueryString({ outletId: outletId ?? undefined, ...rest })}`,
      ),
    staleTime: 30_000,
  })
}
