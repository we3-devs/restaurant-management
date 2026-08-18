import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type {
  AdjustCustomerCreditInput,
  SetCustomerCreditLimitInput,
  SettleCustomerDebtInput,
} from "@rms/validators/customer-credit"

export type CustomerCreditTransactionType = "charge" | "settlement" | "adjustment" | "refund_reversal"

export interface CustomerCreditAccount {
  id: number
  customerId: number
  creditLimit: number
  outstandingBalance: number
  lifetimeCharged: number
  lifetimeSettled: number
  customerName?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerCreditTransaction {
  id: number
  customerId: number
  orderId: number | null
  userId: number | null
  type: CustomerCreditTransactionType
  amount: number
  balanceAfter: number
  notes: string | null
  createdAt: string
}

export interface ListCustomerCreditAccountsParams {
  page?: number
  limit?: number
  search?: string
}

export interface ListCustomerCreditTransactionsParams {
  page?: number
  limit?: number
  customerId?: number
  type?: string
  dateFrom?: string
  dateTo?: string
}

export function useCustomerCreditAccounts(params: ListCustomerCreditAccountsParams = {}) {
  return useQuery({
    queryKey: queryKeys.customerCredit.accounts(params),
    queryFn: () =>
      apiClient<PaginatedResponse<CustomerCreditAccount>>(`/customer-credit/accounts${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useCustomerCreditAccount(customerId: number) {
  return useQuery({
    queryKey: queryKeys.customerCredit.account(customerId),
    queryFn: () => apiClient<CustomerCreditAccount>(`/customer-credit/accounts/${customerId}`),
    enabled: customerId > 0,
  })
}

export function useCustomerCreditTransactions(params: ListCustomerCreditTransactionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.customerCredit.transactions(params),
    queryFn: () =>
      apiClient<PaginatedResponse<CustomerCreditTransaction>>(`/customer-credit/transactions${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useSettleCustomerDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SettleCustomerDebtInput) =>
      apiClient<CustomerCreditTransaction>("/customer-credit/settlements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit.all }),
  })
}

export function useAdjustCustomerCredit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdjustCustomerCreditInput) =>
      apiClient<CustomerCreditTransaction>("/customer-credit/adjustments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit.all }),
  })
}

export function useSetCustomerCreditLimit(customerId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetCustomerCreditLimitInput) =>
      apiClient<CustomerCreditAccount>(`/customer-credit/accounts/${customerId}/limit`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customerCredit.all }),
  })
}
