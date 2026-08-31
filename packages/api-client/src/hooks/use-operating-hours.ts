import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queryKeys } from "../query-keys"

export interface OperatingHoursStatus {
  enabled: boolean
  isOpen: boolean
  openingTime: string | null
  closingTime: string | null
  timezone: string
  nextOpeningAt: string | null
  nextClosingAt: string | null
}

export interface OperatingHoursConfig extends OperatingHoursStatus {}

export function useOperatingHours(outletId?: number | null) {
  return useQuery({
    queryKey: queryKeys.operatingHours.status(outletId),
    queryFn: () => apiClient<OperatingHoursStatus>(`/outlets/${outletId}/operating-hours`),
    enabled: outletId !== null && outletId !== undefined,
    refetchInterval: 60_000,
  })
}

export function useUpdateOperatingHours(outletId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { openingTime?: string; closingTime?: string; timezone?: string; enabled?: boolean }) =>
      apiClient<OperatingHoursStatus>(`/outlets/${outletId}/operating-hours`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.operatingHours.status(outletId) }),
  })
}
