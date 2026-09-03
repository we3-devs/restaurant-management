import { openDB, type DBSchema } from "idb"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../client"
import type { Food } from "./use-foods"
import type { FoodVariant } from "./use-food-variants"
import type { FoodCategory } from "./use-food-categories"

interface MenuCacheSchema extends DBSchema {
  menus: {
    key: string
    value: { key: string; version: string; data: MenuBootstrap }
  }
}

export interface MenuBootstrap {
  version: string
  foods: Food[]
  categories: FoodCategory[]
  foodVariants: FoodVariant[]
  variants: Array<{ id: number; name: string; sortOrder: number }>
  subVariants: Array<{ id: number; name: string; sortOrder: number }>
  addonGroups: Array<{ id: number; name: string; isRequired: boolean; minSelect: number; maxSelect: number | null; sortOrder: number }>
  addons: Array<{ id: number; addonGroupId: number | null; name: string; price: number; sortOrder: number }>
  foodAddonGroups: Array<{ id: number; foodId: number; addonGroupId: number }>
}

const DB_NAME = "rms-operational-cache"
const DB_VERSION = 1

async function database() {
  return openDB<MenuCacheSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("menus")) db.createObjectStore("menus", { keyPath: "key" })
    },
  })
}

async function readMenu(key: string) {
  return (await database()).get("menus", key)
}

async function writeMenu(key: string, data: MenuBootstrap) {
  await (await database()).put("menus", { key, version: data.version, data })
}

/** Menu only. Orders, sessions, payments, kitchen state and availability stay server-driven. */
export function useMenu(outletId: number | null) {
  return useQuery({
    queryKey: ["menu", "cache", outletId],
    enabled: !!outletId && outletId > 0,
    staleTime: 0,
    queryFn: async () => {
      const key = `outlet:${outletId}`
      const cached = await readMenu(key)
      try {
        const current = await apiClient<{ version: string }>(`/menu/version?outletId=${outletId}`)
        if (cached && cached.version === current.version) return cached.data
        const fresh = await apiClient<MenuBootstrap>(`/menu/bootstrap?outletId=${outletId}`)
        await writeMenu(key, fresh)
        return fresh
      } catch (error) {
        if (cached) return cached.data
        throw error
      }
    },
  })
}
