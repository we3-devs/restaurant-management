import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"
import type { CreateFoodRecipeInput } from "@rms/validators/food-recipes"
import type { CreateFoodInput, UpdateFoodInput, UpsertFoodOutletInput } from "@rms/validators/foods"

export interface Food {
  id: number
  foodCategoryId: number | null
  name: string
  slug: string
  skuSegment: string | null
  imageUrl: string | null
  shortDescription: string | null
  description: string | null
  itemType: string
  departmentType: string | null
  hasVariants: boolean
  isTaxable: boolean
  isDiscountable: boolean
  isFeatured: boolean
  isActive: boolean
  preparationTime: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FoodOutlet {
  id: number
  foodId: number
  outletId: number
  price: number | null
  isAvailable: boolean
  isActive: boolean
}

export interface FoodRecipe {
  id: number
  foodId: number
  foodVariantId: number | null
  ingredientId: number
  unitId: number
  quantity: number
  wastageQuantity: number
  isActive: boolean
}

export interface ListFoodsParams {
  page?: number
  limit?: number
  search?: string
  foodCategoryId?: number
}

export function useFoods(params: ListFoodsParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.foods.list(params),
    queryFn: () => apiClient<PaginatedResponse<Food>>(`/foods${toQueryString(params)}`),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useFood(id: number) {
  return useQuery({
    queryKey: queryKeys.foods.detail(id),
    queryFn: () => apiClient<Food>(`/foods/${id}`),
    enabled: id > 0,
  })
}

export function useCreateFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodInput) => apiClient<Food>("/foods", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useUpdateFood(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFoodInput) =>
      apiClient<Food>(`/foods/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.detail(id) })
    },
  })
}

export function useDeleteFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient<void>(`/foods/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useBulkDeleteFoods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      apiClient<{ deleted: number }>("/foods/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useBulkUpdateFoodsDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, departmentType }: { ids: number[]; departmentType: string | null }) =>
      apiClient<{ updated: number }>("/foods/bulk-update-department", {
        method: "POST",
        body: JSON.stringify({ ids, departmentType }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}

export function useResetFoods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient<{ deletedCategories: number; deletedFoods: number; deletedFoodVariants: number }>("/foods/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: "RESET FOODS" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foodCategories.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.lists() })
    },
  })
}

export interface FoodInventoryTracking {
  foodId: number
  /** true: all tracked items share one stock item (Beer). false: each has its own (Coke 1L / 1.5L). */
  shareStock: boolean
  /** The food's other active items stop being tracked. */
  trackedFoodVariantIds: number[]
}

export interface SetInventoryTrackingInput {
  foods: FoodInventoryTracking[]
  outletId: number
  /** Only needed when a new stock item has to be created. */
  ingredientCategoryId?: number
  baseUnitId?: number
}

export function useSetInventoryTracking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetInventoryTrackingInput) =>
      apiClient<{ updated: number; created: number; errors: string[] }>("/foods/inventory-tracking", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Invalidated on failure too: a batch can partly apply before one food
    // errors. Returned so callers see fresh links once mutateAsync resolves.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.foodVariants.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouseIngredientStocks.all }),
      ]),
  })
}

export function useFoodOutlets(foodId: number) {
  return useQuery({
    queryKey: queryKeys.foods.outlets(foodId),
    queryFn: () => apiClient<FoodOutlet[]>(`/foods/${foodId}/outlets`),
    enabled: foodId > 0,
  })
}

export function useUpsertFoodOutlet(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertFoodOutletInput) =>
      apiClient<FoodOutlet>(`/foods/${foodId}/outlets`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.outlets(foodId) }),
  })
}

export function useRemoveFoodOutlet(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outletId: number) =>
      apiClient<void>(`/foods/${foodId}/outlets/${outletId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.outlets(foodId) }),
  })
}

export function useFoodRecipes(foodId: number) {
  return useQuery({
    queryKey: queryKeys.foods.recipes(foodId),
    queryFn: () => apiClient<FoodRecipe[]>(`/foods/${foodId}/recipes`),
    enabled: foodId > 0,
  })
}

export function useAddFoodRecipe(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodRecipeInput) =>
      apiClient<FoodRecipe>(`/foods/${foodId}/recipes`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.recipes(foodId) }),
  })
}

export function useRemoveFoodRecipe(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recipeId: number) =>
      apiClient<void>(`/foods/${foodId}/recipes/${recipeId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.recipes(foodId) }),
  })
}

// Bulk CSV/Excel import moved to the centralized superadmin Data Import
// portal — see @/hooks/use-data-import and apps/dashboard-web's
// (dashboard)/data-import/. The old usePreviewFoodsImport/
// useRevalidateFoodsImport/useCommitFoodsImport hooks and the
// /foods/import/* endpoints they called were removed once the generic
// wizard fully replaced them.
