import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type { CreateUnitConversionInput, CreateUnitInput, UpdateUnitInput } from "@/lib/validators/units"

export interface Unit {
  id: number
  name: string
  shortName: string
  type: "weight" | "volume" | "quantity" | "custom"
  isBase: boolean
  isActive: boolean
}

export interface UnitConversion {
  id: number
  fromUnitId: number
  toUnitId: number
  multiplier: number
  isActive: boolean
}

export interface ListUnitsParams {
  page?: number
  limit?: number
  search?: string
  type?: string
}

export function useUnits(params: ListUnitsParams = {}) {
  return useQuery({
    queryKey: queryKeys.units.list(params),
    queryFn: () => apiClient<PaginatedResponse<Unit>>(`/units${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.units,
  })
}

export function useUnit(id: number) {
  return useQuery({
    queryKey: queryKeys.units.detail(id),
    queryFn: () => apiClient<Unit>(`/units/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.units,
  })
}

export function useCreateUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUnitInput) => apiClient<Unit>("/units", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.units.lists() }),
  })
}

export function useUpdateUnit(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateUnitInput) =>
      apiClient<Unit>(`/units/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(id) })
    },
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/units/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.units.lists() }),
  })
}

export function useUnitConversions(unitId: number) {
  return useQuery({
    queryKey: queryKeys.units.conversions(unitId),
    queryFn: () => apiClient<UnitConversion[]>(`/units/${unitId}/conversions`),
    enabled: unitId > 0,
    staleTime: STALE_TIME.units,
  })
}

export function useAddUnitConversion(unitId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUnitConversionInput) =>
      apiClient<UnitConversion>(`/units/${unitId}/conversions`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.units.conversions(unitId) }),
  })
}
