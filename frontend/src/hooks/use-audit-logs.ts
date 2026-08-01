import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "payment"
  | "refund"
  | "inventory_movement"
  | "purchase_approval"
  | "reservation_change"
  | "settings_change"
  | "role_change"
  | "permission_change"
  | "order_change"
  | "kitchen_status_change"

export interface AuditLog {
  id: number
  userId: number | null
  action: string
  entityType: string
  entityId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface ListAuditLogsParams {
  page?: number
  limit?: number
  userId?: number
  action?: string
  entityType?: string
  entityId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export function useAuditLogs(params: ListAuditLogsParams = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => apiClient<PaginatedResponse<AuditLog>>(`/audit-logs${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

/**
 * Downloads the audit log CSV export. Bypasses apiClient (which always
 * parses JSON) — fetches a blob through the same-origin proxy and triggers a
 * browser download, mirroring downloadReportExport in use-reports.ts.
 */
export async function downloadAuditLogsExport(params: ListAuditLogsParams): Promise<void> {
  const response = await fetch(`/api/backend/audit-logs/export${toQueryString(params)}`)
  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "audit-logs.csv"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
