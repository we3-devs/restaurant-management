import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"

/** One value in a global option list — chicken, veg, full, half. Carries no price. */
export interface VariantListValue {
  id: number
  name: string
  skuSegment: string | null
  sortOrder: number
  isActive: boolean
}

export interface VariantListInput {
  name: string
  skuSegment?: string
  sortOrder?: number
  isActive?: boolean
}

/**
 * Which of the two global lists to read or write. Both share an identical shape
 * and endpoint contract, so one pair of hooks serves both rather than four
 * near-duplicates.
 */
export type VariantList = "variants" | "sub-variants"

export function useVariantList(list: VariantList) {
  return useQuery({
    queryKey: [list],
    queryFn: () => apiClient<VariantListValue[]>(`/${list}`),
  })
}

export function useCreateVariantListValue(list: VariantList) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VariantListInput) =>
      apiClient<VariantListValue>(`/${list}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [list] }),
  })
}

export function useUpdateVariantListValue(list: VariantList, id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VariantListInput) =>
      apiClient<VariantListValue>(`/${list}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [list] })
      // Renaming a value or its segment changes every food item's composed SKU.
      queryClient.invalidateQueries({ queryKey: ["food-variants"] })
    },
  })
}

export function useDeleteVariantListValue(list: VariantList) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<void>(`/${list}/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [list] }),
  })
}
