"use client"

import { useMemo } from "react"

import { useFoodCategories } from "@/hooks/use-food-categories"
import { useFoodVariants, type FoodVariant } from "@/hooks/use-food-variants"
import { useFoods, type Food } from "@/hooks/use-foods"
import { useIngredients, type Ingredient } from "@/hooks/use-ingredients"
import { useWarehouseIngredientStocks } from "@/hooks/use-inventory-stock"
import { useUnits } from "@/hooks/use-units"

export interface MenuStockFood {
  food: Food
  categoryName: string
  /** Active food items (sizes), in menu order. */
  items: FoodVariant[]
}

/**
 * Ready-made foods with their sizes and the stock items those sizes are
 * linked to. Kitchen dishes are left out — they're stocked through recipes.
 */
export function useMenuStock(warehouseId: number | undefined) {
  const { data: foods, isLoading: foodsLoading } = useFoods({ limit: 500 })
  const { data: variants, isLoading: variantsLoading } = useFoodVariants({ limit: 500 })
  const { data: categories } = useFoodCategories({ limit: 500 })
  const { data: ingredients, isLoading: ingredientsLoading } = useIngredients({ limit: 500 })
  const { data: units, isLoading: unitsLoading } = useUnits({ limit: 500 })
  const { data: stocks } = useWarehouseIngredientStocks({ warehouseId, limit: 500 })

  const data = useMemo(() => {
    const categoryNameById = new Map((categories?.data ?? []).map((category) => [category.id, category.name]))
    const itemsByFood = new Map<number, FoodVariant[]>()
    for (const item of variants?.data ?? []) {
      if (!item.isActive) continue
      itemsByFood.set(item.foodId, [...(itemsByFood.get(item.foodId) ?? []), item])
    }
    const menuFoods: MenuStockFood[] = (foods?.data ?? [])
      .filter((food) => food.itemType !== "kitchen" && itemsByFood.has(food.id))
      .map((food) => ({
        food,
        categoryName: categoryNameById.get(food.foodCategoryId ?? 0) ?? "Uncategorized",
        items: itemsByFood.get(food.id)!.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
      }))
      .sort((a, b) => a.food.name.localeCompare(b.food.name))

    return {
      menuFoods,
      ingredientById: new Map((ingredients?.data ?? []).map((ingredient) => [ingredient.id, ingredient])),
      unitById: new Map((units?.data ?? []).map((unit) => [unit.id, unit])),
      availableByIngredient: new Map(
        warehouseId === undefined
          ? []
          : (stocks?.data ?? [])
              .filter((stock) => stock.warehouseId === warehouseId)
              .map((stock) => [stock.ingredientId, Math.max(0, stock.quantity - stock.reservedQuantity)]),
      ),
    }
  }, [foods, variants, categories, ingredients, units, stocks, warehouseId])

  return { ...data, isLoading: foodsLoading || variantsLoading || ingredientsLoading || unitsLoading }
}

/** The stock item this size is linked to, ignoring links to deleted stock items. */
export function liveLink(item: FoodVariant, ingredientById: Map<number, Ingredient>): number | null {
  return item.inventoryIngredientId !== null && ingredientById.has(item.inventoryIngredientId)
    ? item.inventoryIngredientId
    : null
}

/** Size names are free text — "1L" as often as "Coke 1L". */
export function foodItemLabel(food: Food, item: FoodVariant): string {
  return item.name.toLowerCase().includes(food.name.toLowerCase()) ? item.name : `${food.name} ${item.name}`
}

/** Today in the browser's time zone — toISOString() would give the UTC date. */
export function localToday(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
