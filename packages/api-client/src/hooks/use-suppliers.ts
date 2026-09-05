import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type {
  CreateSupplierCategoryInput,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "@rms/validators/suppliers"

export type SupplierStatus = "active" | "inactive"

export interface SupplierCategory {
  id: number
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: number
  supplierNo: string
  companyName: string
  contactPerson: string | null
  phone: string | null
  altPhone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  panVat: string | null
  registrationNo: string | null
  website: string | null
  notes: string | null
  categoryId: number | null
  category: { id: number; name: string } | null
  outletId: number
  defaultPaymentTerms: string | null
  creditLimit: number
  outstandingBalance: number
  totalPurchased: number
  lastPurchaseDate: string | null
  rating: number
  status: SupplierStatus
  createdAt: string
  updatedAt: string
}

export interface SupplierRecentPurchaseOrder {
  poNo: string
  grandTotal: number
  status: string
  createdAt: string | null
}

export interface SupplierHistory {
  supplier: Supplier
  purchaseOrderCount: number
  goodsReceivedCount: number
  purchaseReturnCount: number
  paymentCount: number
  recentPurchaseOrders: SupplierRecentPurchaseOrder[]
}

export interface ListSuppliersParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  categoryId?: number
  outletId?: number
}

export function useSuppliers(params: ListSuppliersParams = {}) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(params),
    queryFn: () => apiClient<PaginatedResponse<Supplier>>(`/suppliers${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: async () => {
      const history = await apiClient<SupplierHistory>(`/suppliers/${id}`)
      return {
        ...history,
        recentPurchaseOrders: history.recentPurchaseOrders.map((order) => {
          if (order.createdAt) return order
          const timestamp = order.poNo.match(/^[^-]+-[^-]+-(\d+)-/)?.[1]
          return {
            ...order,
            createdAt: timestamp ? new Date(Number(timestamp)).toISOString() : null,
          }
        }),
      }
    },
    enabled: id > 0,
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierInput) =>
      apiClient<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() }),
  })
}

export function useUpdateSupplier(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSupplierInput) =>
      apiClient<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(id) })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() }),
  })
}

export function useSupplierCategories() {
  return useQuery({
    queryKey: queryKeys.supplierCategories.list(),
    queryFn: () => apiClient<SupplierCategory[]>("/supplier-categories"),
  })
}

export function useCreateSupplierCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierCategoryInput) =>
      apiClient<SupplierCategory>("/supplier-categories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.supplierCategories.list() }),
  })
}

export function useUpdateSupplierCategory(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSupplierCategoryInput) => apiClient<SupplierCategory>(`/supplier-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.supplierCategories.list() }),
  })
}

export function useDeleteSupplierCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/supplier-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierCategories.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() })
    },
  })
}
