import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"

export type ServiceRequestType = "water" | "bill" | "assistance" | "other"
export type ServiceRequestStatus = "pending" | "in_progress" | "resolved" | "cancelled"

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, string> = {
  water: "Need water",
  bill: "Need bill",
  assistance: "Need assistance",
  other: "Other",
}

export interface ServiceRequest {
  id: number
  outletId: number
  diningTableId: number
  type: ServiceRequestType
  note: string | null
  status: ServiceRequestStatus
  requestedBy: number | null
  resolvedBy: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  diningTable?: { id: number; name: string }
}

export interface ListServiceRequestsParams {
  page?: number
  limit?: number
  outletId?: number
  diningTableId?: number
  status?: string
}

export function useServiceRequests(params: ListServiceRequestsParams = {}) {
  return useQuery({
    queryKey: queryKeys.serviceRequests.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<ServiceRequest>>(
        `/service-requests${toQueryString(params)}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useCreateServiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { diningTableId: number; type: ServiceRequestType; note?: string }) =>
      apiClient<ServiceRequest>("/service-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all }),
  })
}

export function useResolveServiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<ServiceRequest>(`/service-requests/${id}/resolve`, { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequests.all }),
  })
}
