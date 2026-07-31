import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateSupplierPaymentInput } from "@/lib/validators/supplier-payments"

export type PaymentMethod = "cash" | "bank" | "digital"
export type PaymentStatus = "completed" | "pending" | "cancelled"

export interface SupplierPayment {
  id: number
  paymentNo: string
  supplierId: number
  purchaseOrderId: number | null
  outletId: number
  paymentDate: string
  amount: number
  paymentMethod: PaymentMethod
  referenceNo: string | null
  notes: string | null
  status: PaymentStatus
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface ListSupplierPaymentsParams {
  page?: number
  limit?: number
  search?: string
  supplierId?: number
  outletId?: number
  paymentMethod?: string
}

export function useSupplierPayments(params: ListSupplierPaymentsParams = {}) {
  return useQuery({
    queryKey: queryKeys.supplierPayments.list(params),
    queryFn: () => apiClient<PaginatedResponse<SupplierPayment>>(`/supplier-payments${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useSupplierPayment(id: number) {
  return useQuery({
    queryKey: queryKeys.supplierPayments.detail(id),
    queryFn: () => apiClient<SupplierPayment>(`/supplier-payments/${id}`),
    enabled: id > 0,
  })
}

export function useCreateSupplierPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierPaymentInput) =>
      apiClient<SupplierPayment>("/supplier-payments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierPayments.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
    },
  })
}

export function useCancelSupplierPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<SupplierPayment>(`/supplier-payments/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierPayments.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierPayments.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
    },
  })
}
