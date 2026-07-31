import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import { STALE_TIME } from "@/lib/query-config"
import type {
  CreateOutletDepartmentInput,
  UpdateOutletDepartmentInput,
} from "@/lib/validators/outlet-departments"

export interface OutletDepartment {
  id: number
  outletId: number
  name: string
  code: string | null
  type: string
  description: string | null
  isActive: boolean
  canPrepareOrder: boolean
  createdAt: string
  updatedAt: string
}

export interface ListOutletDepartmentsParams {
  page?: number
  limit?: number
  search?: string
  outletId?: number
}

export function useOutletDepartments(params: ListOutletDepartmentsParams = {}) {
  return useQuery({
    queryKey: queryKeys.outletDepartments.list(params),
    queryFn: () =>
      apiClient<PaginatedResponse<OutletDepartment>>(`/outlet-departments${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.departments,
  })
}

export function useOutletDepartment(id: number) {
  return useQuery({
    queryKey: queryKeys.outletDepartments.detail(id),
    queryFn: () => apiClient<OutletDepartment>(`/outlet-departments/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.departments,
  })
}

export function useCreateOutletDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOutletDepartmentInput) =>
      apiClient<OutletDepartment>("/outlet-departments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outletDepartments.lists() }),
  })
}

export function useUpdateOutletDepartment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOutletDepartmentInput) =>
      apiClient<OutletDepartment>(`/outlet-departments/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outletDepartments.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.outletDepartments.detail(id) })
    },
  })
}

export function useDeleteOutletDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/outlet-departments/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outletDepartments.lists() }),
  })
}
