import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateRoleInput, UpdateRoleInput } from "@/lib/validators/roles"

export interface Role {
  id: number
  name: string
  slug: string
  level: string
  rank: number
  isAssignable: boolean
  isSystem: boolean
  isActive: boolean
  description: string | null
  permissions?: string[]
  createdAt: string
  updatedAt: string
}

export interface ListRolesParams {
  page?: number
  limit?: number
  search?: string
}

export function useRoles(params: ListRolesParams = {}) {
  return useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => apiClient<PaginatedResponse<Role>>(`/roles${toQueryString(params)}`),
  })
}

export function useRole(id: number) {
  return useQuery({
    queryKey: queryKeys.roles.detail(id),
    queryFn: () => apiClient<Role>(`/roles/${id}`),
    enabled: id > 0,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRoleInput) => apiClient<Role>("/roles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() }),
  })
}

export function useUpdateRole(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateRoleInput) =>
      apiClient<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(id) })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.lists() }),
  })
}

export function useAssignPermission(roleId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (permissionId: number) =>
      apiClient<void>(`/roles/${roleId}/permissions`, { method: "POST", body: JSON.stringify({ permissionId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) }),
  })
}

export function useUnassignPermission(roleId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (permissionId: number) =>
      apiClient<void>(`/roles/${roleId}/permissions/${permissionId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) }),
  })
}
