import { z } from "zod"
import { toTitleCase } from "./helpers"

export const FOOD_TYPES = ["veg", "non_veg", "egg", "vegan"] as const
export const FOOD_ITEM_TYPES = ["kitchen", "ready_made"] as const

/** Mirrors backend OUTLET_DEPARTMENT_TYPES. Kitchen items are routed by this department type; ready-made items have none. */
export const OUTLET_DEPARTMENT_TYPES = [
  "kitchen",
  "bar",
  "grill",
  "pizza",
  "dessert",
  "drinks",
  "counter",
  "store",
  "bakery",
  "housekeeping",
  "other",
] as const

export const createFoodSchema = z.object({
  foodCategoryId: z.number().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase, alphanumeric, hyphen-separated"),
  sku: z.string().optional(),
  /** This level's SKU piece, e.g. MOMO. Composed with variant segments into the full code. */
  skuSegment: z.string().max(32).optional(),
  imageUrl: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  itemType: z.enum(FOOD_ITEM_TYPES),
  departmentType: z.enum(OUTLET_DEPARTMENT_TYPES).optional(),
  inventoryIngredientId: z.number().int().positive().nullable().optional(),
  basePrice: z.number().min(0),
})

export type CreateFoodInput = z.infer<typeof createFoodSchema>

export const updateFoodSchema = z.object({
  foodCategoryId: z.number().nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").transform(toTitleCase),
  sku: z.string().optional(),
  skuSegment: z.string().max(32).optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  foodType: z.enum(FOOD_TYPES).optional(),
  itemType: z.enum(FOOD_ITEM_TYPES),
  departmentType: z.enum(OUTLET_DEPARTMENT_TYPES).nullable().optional(),
  inventoryIngredientId: z.number().int().positive().nullable().optional(),
  basePrice: z.number().min(0),
  isTaxable: z.boolean(),
  isDiscountable: z.boolean(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
})

export type UpdateFoodInput = z.infer<typeof updateFoodSchema>

export const upsertFoodOutletSchema = z.object({
  outletId: z.number().positive(),
  price: z.number().min(0).optional(),
  isAvailable: z.boolean(),
})

export type UpsertFoodOutletInput = z.infer<typeof upsertFoodOutletSchema>
