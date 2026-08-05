import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString } from "../types"
import { queryKeys } from "../query-keys"

export type ReportType =
  | "sales"
  | "orders"
  | "inventory"
  | "stock-movements"
  | "ingredient-consumption"
  | "wastage"
  | "kitchen-performance"
  | "reservations"
  | "customers"
  | "payments"
  | "suppliers"
  | "purchase-orders"
  | "goods-receiving"
  | "purchase-returns"
  | "supplier-payments"
  | "employees"
  | "attendance"
  | "shifts"
  | "staff-performance"
  | "payroll-export"
  | "settings-changes"
  | "audit-logs"
  | "loyalty-top-customers"
  | "loyalty-points-earned"
  | "loyalty-points-redeemed"
  | "loyalty-outstanding"
  | "loyalty-transactions"

export interface ReportColumn {
  key: string
  header: string
}

export interface ReportResponse {
  data: Record<string, unknown>[]
  meta: { page: number; limit: number; total: number; totalPages: number }
  columns: ReportColumn[]
}

export interface ReportParams {
  outletId?: number | null
  dateFrom?: string
  dateTo?: string
  search?: string
  sortDir?: "ASC" | "DESC"
  page?: number
  limit?: number
}

export function useReport(type: ReportType, params: ReportParams) {
  const { outletId, ...rest } = params
  return useQuery({
    queryKey: queryKeys.reports.detail(type, params),
    queryFn: () =>
      apiClient<ReportResponse>(
        `/reports/${type}${toQueryString({ outletId: outletId ?? undefined, ...rest })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

/**
 * Downloads a report export. Bypasses apiClient (which always parses JSON)
 * — fetches a blob through the same-origin proxy and triggers a browser
 * download via a throwaway anchor + object URL.
 */
export async function downloadReportExport(
  type: ReportType,
  params: ReportParams,
  format: "csv" | "xlsx" | "pdf",
): Promise<void> {
  const { outletId, ...rest } = params
  const query = toQueryString({ outletId: outletId ?? undefined, ...rest, format })
  const response = await fetch(`/api/backend/reports/${type}/export${query}`)
  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${type}-report.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
