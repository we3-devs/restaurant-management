import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type {
  CreateInventoryKitInput,
  CreateKitItemInput,
  CreateKitPortionInput,
  UpdateInventoryKitInput,
} from "@rms/validators/inventory-kits"

export interface InventoryKit {
  id: number
  name: string
  slug: string
  description: string | null
  isActive: boolean
}

export interface InventoryKitItem {
  id: number
  kitId: number
  ingredientId: number
  label: string
  unitId: number
  sortOrder: number
  isActive: boolean
}

export interface InventoryKitPortion {
  id: number
  kitItemId: number
  name: string
  unitId: number
  quantity: number
  isActive: boolean
}

export interface ListInventoryKitsParams {
  page?: number
  limit?: number
  search?: string
}

export function useInventoryKits(params: ListInventoryKitsParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventoryKits.list(params),
    queryFn: () => apiClient<PaginatedResponse<InventoryKit>>(`/inventory-kits${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.reference,
  })
}

export function useInventoryKit(id: number) {
  return useQuery({
    queryKey: queryKeys.inventoryKits.detail(id),
    queryFn: () => apiClient<InventoryKit>(`/inventory-kits/${id}`),
    enabled: id > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useCreateInventoryKit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInventoryKitInput) =>
      apiClient<InventoryKit>("/inventory-kits", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.lists() }),
  })
}

export function useUpdateInventoryKit(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateInventoryKitInput) =>
      apiClient<InventoryKit>(`/inventory-kits/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.detail(id) })
    },
  })
}

export function useDeleteInventoryKit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/inventory-kits/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.lists() }),
  })
}

export function useKitItems(kitId: number) {
  return useQuery({
    queryKey: queryKeys.inventoryKits.items(kitId),
    queryFn: () => apiClient<InventoryKitItem[]>(`/inventory-kits/${kitId}/items`),
    enabled: kitId > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useAddKitItem(kitId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateKitItemInput) =>
      apiClient<InventoryKitItem>(`/inventory-kits/${kitId}/items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.items(kitId) }),
  })
}

export function useRemoveKitItem(kitId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      apiClient<void>(`/inventory-kits/${kitId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.items(kitId) }),
  })
}

export function useKitPortions(kitId: number, itemId: number) {
  return useQuery({
    queryKey: queryKeys.inventoryKits.portions(kitId, itemId),
    queryFn: () => apiClient<InventoryKitPortion[]>(`/inventory-kits/${kitId}/items/${itemId}/portions`),
    enabled: kitId > 0 && itemId > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useAddKitPortion(kitId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateKitPortionInput) =>
      apiClient<InventoryKitPortion>(`/inventory-kits/${kitId}/items/${itemId}/portions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.portions(kitId, itemId) }),
  })
}

export function useRemoveKitPortion(kitId: number, itemId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (portionId: number) =>
      apiClient<void>(`/inventory-kits/${kitId}/items/${itemId}/portions/${portionId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryKits.portions(kitId, itemId) }),
  })
}
