/** Response projections used by the unauthenticated guest menu APIs. */
export interface PublicFood {
  id: number
  foodCategoryId: number | null
  name: string
  shortDescription?: string | null
  imageUrl: string | null
  basePrice: number
  hasVariants: boolean
  hasAddons: boolean
}

export interface PublicFoodCategory {
  id: number
  parentId: number | null
  name: string
}

export interface PublicFoodVariant {
  id: number
  foodId: number
  variantId: number | null
  subVariantId: number | null
  name: string
  price: number
  isDefault: boolean
}

export interface PublicListValue {
  id: number
  name: string
  sortOrder: number
}
