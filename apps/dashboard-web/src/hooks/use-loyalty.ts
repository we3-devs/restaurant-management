import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { AdjustLoyaltyPointsInput } from "@/lib/validators/loyalty"

export type LoyaltyTransactionType = "earn" | "redeem" | "adjustment" | "expiry" | "refund_reversal"

export interface LoyaltyAccount {
  id: number
  customerId: number
  currentPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  expiringPoints: number
  tier: string | null
  customerName?: string
  createdAt: string
  updatedAt: string
}

export interface LoyaltyTransaction {
  id: number
  customerId: number
  orderId: number | null
  userId: number | null
  type: LoyaltyTransactionType
  points: number
  balanceAfter: number
  source: string | null
  notes: string | null
  expiresAt: string | null
  isExpired: boolean
  createdAt: string
}

export interface ListLoyaltyAccountsParams {
  page?: number
  limit?: number
  search?: string
}

export interface ListLoyaltyTransactionsParams {
  page?: number
  limit?: number
  customerId?: number
  type?: string
  dateFrom?: string
  dateTo?: string
}

export function useLoyaltyAccounts(params: ListLoyaltyAccountsParams = {}) {
  return useQuery({
    queryKey: queryKeys.loyalty.accounts(params),
    queryFn: () => apiClient<PaginatedResponse<LoyaltyAccount>>(`/loyalty/accounts${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useLoyaltyAccount(customerId: number) {
  return useQuery({
    queryKey: queryKeys.loyalty.account(customerId),
    queryFn: () => apiClient<LoyaltyAccount>(`/loyalty/accounts/${customerId}`),
    enabled: customerId > 0,
  })
}

export function useLoyaltyTransactions(params: ListLoyaltyTransactionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.loyalty.transactions(params),
    queryFn: () => apiClient<PaginatedResponse<LoyaltyTransaction>>(`/loyalty/transactions${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useAdjustLoyaltyPoints() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdjustLoyaltyPointsInput) =>
      apiClient<LoyaltyTransaction>("/loyalty/adjustments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all }),
  })
}
