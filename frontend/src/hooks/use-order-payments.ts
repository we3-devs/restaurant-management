import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { toQueryString, type PaginatedResponse } from "@/lib/api/types"
import { queryKeys } from "@/lib/query-keys"
import type { CreateOrderPaymentInput } from "@/lib/validators/orders"

export interface OrderPayment {
  id: number
  outletId: number
  orderId: number
  paymentNumber: string
  type: string
  method: string
  amount: number
  status: string
  note: string | null
  createdAt: string
}

export function useOrderPayments(orderId: number) {
  return useQuery({
    queryKey: queryKeys.orders.payments(orderId),
    queryFn: () =>
      apiClient<PaginatedResponse<OrderPayment>>(`/order-payments${toQueryString({ orderId, limit: 100 })}`),
    enabled: orderId > 0,
  })
}

export function useCreateOrderPayment(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderPaymentInput) =>
      apiClient<OrderPayment>(`/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.payments(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
    },
  })
}
