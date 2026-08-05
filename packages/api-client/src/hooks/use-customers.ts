import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { CreateCustomerInput, UpdateCustomerInput } from "@rms/validators/customers"

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerOutlet {
  id: number
  customerId: number
  outletId: number
  firstVisitedAt: string | null
  lastVisitedAt: string | null
  visitCount: number
  isFavoriteOutlet: boolean
}

export interface ListCustomersParams {
  page?: number
  limit?: number
  search?: string
}

export function useCustomers(params: ListCustomersParams = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => apiClient<PaginatedResponse<Customer>>(`/customers${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.customersList,
  })
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => apiClient<Customer>(`/customers/${id}`),
    enabled: id > 0,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomerInput) =>
      apiClient<Customer>("/customers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() }),
  })
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) =>
      apiClient<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(id) })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() }),
  })
}

export function useCustomerOutlets(customerId: number) {
  return useQuery({
    queryKey: queryKeys.customers.outlets(customerId),
    queryFn: () => apiClient<CustomerOutlet[]>(`/customers/${customerId}/outlets`),
    enabled: customerId > 0,
  })
}

export function useUpdateCustomerOutlet(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ outletId, isFavoriteOutlet }: { outletId: number; isFavoriteOutlet: boolean }) =>
      apiClient<CustomerOutlet>(`/customers/${customerId}/outlets/${outletId}`, {
        method: "PATCH",
        body: JSON.stringify({ isFavoriteOutlet }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.outlets(customerId) }),
  })
}
