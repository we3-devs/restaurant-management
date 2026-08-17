import { useQuery } from "@tanstack/react-query"
import { customerApiClient } from "../customer-client"
import { toQueryString, type PaginatedResponse } from "../types"
import { queryKeys } from "../query-keys"

export interface PublicFoodCategory {
  id: number
  parentId: number | null
  name: string
}

export interface PublicFood {
  id: number
  foodCategoryId: number | null
  name: string
  shortDescription: string | null
  imageUrl: string | null
  basePrice: number
  hasVariants: boolean
  hasAddons: boolean
}

/** A sellable food item: this food paired with values from the global option lists. */
export interface PublicFoodVariant {
  id: number
  foodId: number
  variantId: number | null
  subVariantId: number | null
  name: string
  price: number
  isDefault: boolean
}

/** One value from /variants/public or /sub-variants/public. */
export interface PublicVariantListValue {
  id: number
  name: string
  sortOrder: number
}

export interface ListPublicFoodsParams {
  search?: string
  foodCategoryId?: number
  limit?: number
}

// The menu barely changes minute-to-minute — a long staleTime plus mounting
// these hooks at the page level (see guest-page-content.tsx) is what makes
// the data load in the background as soon as /guest opens and stay cached
// for the rest of the visit, instead of re-fetching every time the order
// modal opens.
const MENU_STALE_TIME = 5 * 60_000

/** /foods/public, /food-categories/public, /food-variants/public are @Public() on the backend — no customer session required to browse, only to submit an order. */
export function usePublicFoodCategories() {
  return useQuery({
    queryKey: queryKeys.guestMenu.categories(),
    queryFn: () =>
      customerApiClient<PaginatedResponse<PublicFoodCategory>>(
        `/food-categories/public${toQueryString({ limit: 100 })}`,
      ),
    staleTime: MENU_STALE_TIME,
  })
}

export function usePublicFoods(params: ListPublicFoodsParams = {}) {
  return useQuery({
    queryKey: queryKeys.guestMenu.foods(params),
    queryFn: () => customerApiClient<PaginatedResponse<PublicFood>>(`/foods/public${toQueryString(params)}`),
    staleTime: MENU_STALE_TIME,
  })
}

export function usePublicFoodVariants(foodId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.guestMenu.variants(foodId),
    queryFn: () =>
      customerApiClient<PaginatedResponse<PublicFoodVariant>>(
        `/food-variants/public${toQueryString({ foodId, limit: 50 })}`,
      ),
    enabled: foodId !== undefined,
    staleTime: MENU_STALE_TIME,
  })
}
