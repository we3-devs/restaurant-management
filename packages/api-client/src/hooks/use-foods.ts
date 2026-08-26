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
  sku: string | null
  skuSegment: string | null
  imageUrl: string | null
  shortDescription: string | null
  description: string | null
  foodType: string | null
  itemType: string
  departmentType: string | null
  basePrice: number
  hasVariants: boolean
  hasAddons: boolean
  isRecipeEnabled: boolean
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

export interface FoodAddonGroupLink {
  id: number
  foodId: number
  addonGroupId: number
  addonGroup?: { id: number; name: string }
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

export function useFoodAddonGroups(foodId: number) {
  return useQuery({
    queryKey: queryKeys.foods.addonGroups(foodId),
    queryFn: () => apiClient<FoodAddonGroupLink[]>(`/foods/${foodId}/addon-groups`),
    enabled: foodId > 0,
  })
}

export function useAssignFoodAddonGroup(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonGroupId: number) =>
      apiClient<void>(`/foods/${foodId}/addon-groups`, { method: "POST", body: JSON.stringify({ addonGroupId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.addonGroups(foodId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.detail(foodId) })
    },
  })
}

export function useUnassignFoodAddonGroup(foodId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (addonGroupId: number) =>
      apiClient<void>(`/foods/${foodId}/addon-groups/${addonGroupId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.addonGroups(foodId) }),
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

export interface ImportFoodRow {
  rowNumber: number
  name: string
  slug: string
  sku: string | null
  shortDescription: string | null
  imageUrl: string | null
  foodCategoryName: string | null
  foodCategoryId: number | null
  itemType: string
  departmentType: string | null
  foodType: string | null
  basePrice: number
  errors: string[]
}

export interface ImportFoodsPreviewResult {
  rows: ImportFoodRow[]
  validCount: number
  invalidCount: number
}

export interface ImportFoodsCommitResult {
  createdCount: number
  failedCount: number
  failures: { index: number; name: string; error: string }[]
}

/**
 * Deliberately does not go through apiClient: that helper forces
 * Content-Type: application/json, whereas FormData needs the browser to set
 * the header itself so the generated multipart boundary is included.
 *
 * Uses XMLHttpRequest rather than fetch specifically so upload progress is
 * observable — fetch has no upload-progress event, only XHR does.
 */
export function usePreviewFoodsImport() {
  return useMutation({
    mutationFn: ({ file, onUploadProgress }: { file: File; onUploadProgress?: (percent: number) => void }) =>
      new Promise<ImportFoodsPreviewResult>((resolve, reject) => {
        const form = new FormData()
        form.append("file", file)

        const xhr = new XMLHttpRequest()
        xhr.open("POST", "/api/backend/foods/import/preview")
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onUploadProgress) {
            onUploadProgress(Math.round((event.loaded / event.total) * 100))
          }
        }
        xhr.onload = () => {
          let body: unknown = null
          try {
            body = JSON.parse(xhr.responseText)
          } catch {
            // non-JSON error body, fall through to status-based message below
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as ImportFoodsPreviewResult)
          } else {
            const message = (body as { message?: string } | null)?.message
            reject(new Error(message ?? `Import preview failed with ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error("Network error while uploading the file"))
        xhr.send(form)
      }),
  })
}

export function useRevalidateFoodsImport() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      apiClient<ImportFoodsPreviewResult>("/foods/import/revalidate", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  })
}

export function useCommitFoodsImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: CreateFoodInput[]) =>
      apiClient<ImportFoodsCommitResult>("/foods/import/commit", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foods.lists() }),
  })
}
