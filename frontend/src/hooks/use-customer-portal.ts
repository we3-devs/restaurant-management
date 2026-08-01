import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type {
  UpdatePreferencesInput,
  UpdateProfileInput,
  UpsertAddressInput,
} from "@/lib/validators/customer-portal"

/** Browser-side fetch wrapper for the customer portal proxy (mirrors apiClient, different base path). */
async function customerApiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/customer-backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `Request to ${path} failed with ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export interface CustomerAddress {
  id: string
  label: string
  line1: string
  line2?: string
  city?: string
  isDefault: boolean
}

export interface CustomerProfile {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  dateOfBirth: string | null
  dietaryPreferences: string[] | null
  allergies: string[] | null
  favoriteFoodIds: number[] | null
  addresses: CustomerAddress[] | null
}

export interface PortalOrder {
  id: number
  orderNumber: string
  status: string
  paymentStatus: string
  grandTotal: number
  dueAmount: number
  createdAt: string
}

export interface LoyaltyAccount {
  customerId: number
  currentPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  expiringPoints: number
  tier: string | null
}

export function useCustomerProfile() {
  return useQuery({
    queryKey: queryKeys.customerPortal.profile(),
    queryFn: () => customerApiClient<CustomerProfile>("/customer-portal/profile"),
  })
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      customerApiClient<CustomerProfile>("/customer-portal/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.profile() }),
  })
}

export function useUpdateCustomerPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) =>
      customerApiClient<CustomerProfile>("/customer-portal/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.profile() }),
  })
}

export function useCustomerAddresses() {
  return useQuery({
    queryKey: queryKeys.customerPortal.addresses(),
    queryFn: () => customerApiClient<CustomerAddress[]>("/customer-portal/addresses"),
  })
}

export function useAddCustomerAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertAddressInput) =>
      customerApiClient<CustomerAddress[]>("/customer-portal/addresses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.addresses() }),
  })
}

export function useRemoveCustomerAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addressId: string) =>
      customerApiClient<CustomerAddress[]>(`/customer-portal/addresses/${addressId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.addresses() }),
  })
}

export function useCustomerFavorites() {
  return useQuery({
    queryKey: queryKeys.customerPortal.favorites(),
    queryFn: () => customerApiClient<number[]>("/customer-portal/favorites"),
  })
}

export function useToggleCustomerFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (foodId: number) =>
      customerApiClient<number[]>("/customer-portal/favorites/toggle", {
        method: "POST",
        body: JSON.stringify({ foodId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.favorites() }),
  })
}

export function useCustomerOrders(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.customerPortal.orders(params),
    queryFn: () =>
      customerApiClient<PaginatedResponse<PortalOrder>>(`/customer-portal/orders${toQueryString(params)}`),
  })
}

export function useCustomerOrder(orderId: number) {
  return useQuery({
    queryKey: queryKeys.customerPortal.order(orderId),
    queryFn: () => customerApiClient<PortalOrder>(`/customer-portal/orders/${orderId}`),
    enabled: orderId > 0,
  })
}

export function useCustomerLoyalty() {
  return useQuery({
    queryKey: queryKeys.customerPortal.loyalty(),
    queryFn: () => customerApiClient<LoyaltyAccount>("/customer-portal/loyalty"),
  })
}

export function useCustomerLoyaltyHistory(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.customerPortal.loyaltyHistory(params),
    queryFn: () =>
      customerApiClient<
        PaginatedResponse<{ id: number; type: string; points: number; balanceAfter: number; createdAt: string }>
      >(`/customer-portal/loyalty/history${toQueryString(params)}`),
  })
}
