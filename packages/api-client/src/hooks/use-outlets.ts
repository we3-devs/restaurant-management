import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateOutletInput, UpdateOutletInput } from "@rms/validators/outlets"

export interface Outlet {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  tenant?: { id: number; name: string }
}

export interface SuperadminTenant {
  id: number
  name: string
  slug: string
  isActive: boolean
  outlets?: Outlet[]
}

export function useSuperadminOutlets(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.outlets.superadminAll(),
    queryFn: () => apiClient<Outlet[]>("/superadmin/outlets"),
    staleTime: STALE_TIME.outlets,
    enabled: options.enabled ?? true,
  })
}

export function useSuperadminTenants(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.outlets.superadminTenants(),
    queryFn: () => apiClient<SuperadminTenant[]>("/superadmin/tenants"),
    staleTime: STALE_TIME.outlets,
    enabled: options.enabled ?? true,
  })
}

export function useUpdateSuperadminTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; isActive?: boolean }) =>
      apiClient<SuperadminTenant>(`/superadmin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.superadminTenants() }),
  })
}

export function useDeleteSuperadminTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/superadmin/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.superadminTenants() }),
  })
}

export interface ListOutletsParams {
  page?: number
  limit?: number
  search?: string
}

export function useOutlets(params: ListOutletsParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.outlets.list(params),
    queryFn: () => apiClient<PaginatedResponse<Outlet>>(`/outlets${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.outlets,
    enabled: options.enabled ?? true,
  })
}

/** Only the current user's assigned outlets — no `outlets.view` permission required. Superadmins/globally-scoped users get every outlet back. */
export function useAssignedOutlets(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.outlets.assigned(),
    queryFn: () => apiClient<Outlet[]>("/outlets/assigned"),
    staleTime: STALE_TIME.outlets,
    enabled: options.enabled ?? true,
  })
}

export function useOutlet(id: number) {
  return useQuery({
    queryKey: queryKeys.outlets.detail(id),
    queryFn: () => apiClient<Outlet>(`/outlets/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.outlets,
  })
}

export function useCreateOutlet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOutletInput) => apiClient<Outlet>("/outlets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() }),
  })
}

export function useUpdateOutlet(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOutletInput) =>
      apiClient<Outlet>(`/outlets/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.outlets.detail(id) })
    },
  })
}

export function useDeleteOutlet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/outlets/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.outlets.lists() }),
  })
}
