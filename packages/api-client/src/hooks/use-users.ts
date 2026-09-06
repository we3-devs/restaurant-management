import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { CreateUserInput, UpdateUserInput } from "@rms/validators/users"

export interface User {
  id: number
  name: string
  email: string
  isSuperadmin: boolean
  isActive: boolean
  phone?: string | null
  employeeId: number | null
  outletId: number | null
  departmentId: number | null
  createdAt: string
}

export interface RoleAssignment {
  id: number
  roleId: number
  roleName: string
  roleSlug: string
  scopeType: string
  isActive: boolean
  createdAt: string
}

export interface ListUsersParams {
  page?: number
  limit?: number
  search?: string
}

export function useUsers(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => apiClient<PaginatedResponse<User>>(`/users${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useUser(id: number) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => apiClient<User>(`/users/${id}`),
    enabled: id > 0,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => apiClient<User>("/users", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }),
  })
}

export function useUpdateUser(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateUserInput) =>
      apiClient<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
    },
  })
}

export function useResetUserPassword(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiClient<void>(`/users/${id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
    },
  })
}

export function useDeactivateUser(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient<void>(`/users/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
    },
  })
}

export function useUserRoleAssignments(userId: number) {
  return useQuery({
    queryKey: queryKeys.users.roleAssignments(userId),
    queryFn: () => apiClient<RoleAssignment[]>(`/users/${userId}/role-assignments`),
    enabled: userId > 0,
  })
}

export function useAssignRole(userId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: number) =>
      apiClient<void>(`/users/${userId}/role-assignments`, { method: "POST", body: JSON.stringify({ roleId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.roleAssignments(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) })
    },
  })
}

/** Creates the user, then immediately assigns a role if one was picked — one form action instead of "create, then go find them again to assign a role". */
export function useCreateUserWithRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roleId, ...input }: CreateUserInput & { roleId?: number }) => {
      const user = await apiClient<User>("/users", { method: "POST", body: JSON.stringify(input) })
      if (roleId) {
        await apiClient<void>(`/users/${user.id}/role-assignments`, {
          method: "POST",
          body: JSON.stringify({ roleId }),
        })
      }
      return user
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.roleAssignments(user.id) })
    },
  })
}

export function useRevokeRoleAssignment(userId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: number) =>
      apiClient<void>(`/users/${userId}/role-assignments/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.roleAssignments(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) })
    },
  })
}
