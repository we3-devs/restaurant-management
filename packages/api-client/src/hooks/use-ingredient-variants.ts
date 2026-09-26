import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type {
  CreateIngredientVariantInput,
  CreateIngredientVariantPortionInput,
  ReceiveVariantsStockInput,
} from "@rms/validators/ingredient-variants"

export interface IngredientVariant {
  id: number
  parentIngredientId: number
  ingredientId: number
  label: string
  unitId: number
  unitsPerPackage: number | null
  packageLabel: string | null
  sortOrder: number
  isActive: boolean
}

export interface IngredientVariantWithParent extends IngredientVariant {
  parentName: string
}

export interface IngredientVariantPortion {
  id: number
  ingredientVariantId: number
  name: string
  unitId: number
  quantity: number
  isActive: boolean
}

/** Size variants of a base item — shown on that item's own detail page. */
export function useIngredientVariants(parentIngredientId: number) {
  return useQuery({
    queryKey: queryKeys.ingredientVariants.forParent(parentIngredientId),
    queryFn: () => apiClient<IngredientVariant[]>(`/ingredients/${parentIngredientId}/variants`),
    enabled: parentIngredientId > 0,
    staleTime: STALE_TIME.reference,
  })
}

/** Reverse lookup: which base item(s) this ingredient is itself a variant of. */
export function useIngredientVariantsForIngredient(ingredientId: number) {
  return useQuery({
    queryKey: queryKeys.ingredientVariants.forIngredient(ingredientId),
    queryFn: () => apiClient<IngredientVariantWithParent[]>(`/ingredient-variants?ingredientId=${ingredientId}`),
    enabled: ingredientId > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useAddIngredientVariant(parentIngredientId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientVariantInput) =>
      apiClient<IngredientVariant>(`/ingredients/${parentIngredientId}/variants`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (variant) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientVariants.forParent(parentIngredientId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientVariants.forIngredient(variant.ingredientId) })
    },
  })
}

export function useRemoveIngredientVariant(parentIngredientId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variantId: number) =>
      apiClient<void>(`/ingredients/${parentIngredientId}/variants/${variantId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientVariants.forParent(parentIngredientId) })
      // The ingredient this variant pointed at isn't known here — broadly
      // invalidate rather than skip refreshing its "variant of" section.
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredientVariants.all })
    },
  })
}

export function useIngredientVariantPortions(parentIngredientId: number, variantId: number) {
  return useQuery({
    queryKey: queryKeys.ingredientVariants.portions(parentIngredientId, variantId),
    queryFn: () =>
      apiClient<IngredientVariantPortion[]>(
        `/ingredients/${parentIngredientId}/variants/${variantId}/portions`,
      ),
    enabled: parentIngredientId > 0 && variantId > 0,
    staleTime: STALE_TIME.reference,
  })
}

export function useAddIngredientVariantPortion(parentIngredientId: number, variantId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIngredientVariantPortionInput) =>
      apiClient<IngredientVariantPortion>(
        `/ingredients/${parentIngredientId}/variants/${variantId}/portions`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.ingredientVariants.portions(parentIngredientId, variantId),
      }),
  })
}

export function useRemoveIngredientVariantPortion(parentIngredientId: number, variantId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (portionId: number) =>
      apiClient<void>(
        `/ingredients/${parentIngredientId}/variants/${variantId}/portions/${portionId}`,
        { method: "DELETE" },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.ingredientVariants.portions(parentIngredientId, variantId),
      }),
  })
}

/**
 * Receives stock for several variants of the same base item at once (e.g.
 * cartons of two different bottle sizes), saved as one batch.
 */
export function useReceiveVariantsStock(parentIngredientId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReceiveVariantsStockInput) =>
      apiClient<void>(`/ingredients/${parentIngredientId}/variants/receive-stock`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all })
    },
  })
}
