import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateTableSessionInput, TransferTableSessionInput } from "@/lib/validators/table-sessions"

export interface TableSession {
  id: number
  outletId: number
  diningTableId: number
  reservationId: number | null
  customerId: number | null
  guestCount: number
  source: string
  status: string
  startedAt: string | null
  endedAt: string | null
  startedBy: number | null
  endedBy: number | null
  transferredBy: number | null
  transferredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ListTableSessionsParams {
  page?: number
  limit?: number
  outletId?: number
  diningTableId?: number
  status?: string
}

export function useTableSessions(params: ListTableSessionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.tableSessions.list(params),
    queryFn: () => apiClient<PaginatedResponse<TableSession>>(`/table-sessions${toQueryString(params)}`),
  })
}

export function useTableSession(id: number) {
  return useQuery({
    queryKey: queryKeys.tableSessions.detail(id),
    queryFn: () => apiClient<TableSession>(`/table-sessions/${id}`),
    enabled: id > 0,
  })
}

export function useStartTableSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTableSessionInput) =>
      apiClient<TableSession>("/table-sessions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}

export function useEndTableSession(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<TableSession>(`/table-sessions/${id}/end`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}

export function useTransferTableSession(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TransferTableSessionInput) =>
      apiClient<TableSession>(`/table-sessions/${id}/transfer`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.tableSessions.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diningTables.lists() })
    },
  })
}
