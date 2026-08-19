import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { asPaginated } from "../bootstrap-helpers"
import { queryKeys } from "../query-keys"
import { STALE_TIME } from "../query-config"
import type { Addon } from "./use-addons"
import type { DiningTable } from "./use-dining-tables"
import type { FoodCategory } from "./use-food-categories"
import type { Outlet } from "./use-outlets"
import type { OutletDepartment } from "./use-outlet-departments"
import type { Customer } from "./use-customers"
import type { Ingredient } from "./use-ingredients"
import type { IngredientCategory } from "./use-ingredient-categories"
import type { Unit } from "./use-units"
import type { Warehouse } from "./use-warehouses"
import type { Reservation } from "./use-reservations"
import type { PaginatedResponse } from "../types"

/**
 * Bootstrap hooks: one HTTP request per screen instead of the 4-6 a POS or
 * Reservations mount used to fire independently. Today they hit real
 * aggregate backend endpoints (/pos/bootstrap, /reservations/bootstrap,
 * /inventory/bootstrap); if that ever needs to change, only the queryFn
 * below changes — every caller keeps using the same hook.
 *
 * Each hook also seeds the cache entries the individual resource hooks
 * (useOutletDepartments, useFoodCategories, useAddons, ...) would otherwise
 * fetch themselves, using the exact same query keys — so components deeper
 * in the tree keep calling their normal hooks and transparently get a cache
 * hit instead of a network request.
 */

// /pos/bootstrap is waiter-facing and intentionally returns a minimal
// projection of each entity (no timestamps/internal fields, see
// backend WaiterPosBootstrapResponseDto) — narrower than the full
// Outlet/OutletDepartment/DiningTable/FoodCategory/Addon shapes those
// hooks' own REST endpoints return. It's still safe to seed those hooks'
// query caches from this data because every field the POS screen's
// components actually read (name, status, capacity, diningAreaId, etc.)
// is present; components that need the full shape (e.g. the dining-tables
// floor-plan editor) live outside the POS screen and will simply issue
// their own fresh request the first time they're visited.
export type PosBootstrapOutlet = Pick<Outlet, "id" | "name">
export type PosBootstrapDepartment = Pick<
  OutletDepartment,
  "id" | "outletId" | "name" | "type" | "canPrepareOrder"
>
export type PosBootstrapTable = Pick<
  DiningTable,
  "id" | "outletId" | "diningAreaId" | "name" | "code" | "capacity" | "status" | "isActive"
>
export type PosBootstrapFoodCategory = Pick<FoodCategory, "id" | "parentId" | "name" | "sortOrder">
export type PosBootstrapAddon = Pick<Addon, "id" | "addonGroupId" | "name" | "price">

export interface PosBootstrap {
  outlet: PosBootstrapOutlet
  departments: PosBootstrapDepartment[]
  tables: PosBootstrapTable[]
  foodCategories: PosBootstrapFoodCategory[]
  addons: PosBootstrapAddon[]
}

export function usePosBootstrap(outletId: number | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["pos", "bootstrap", outletId],
    queryFn: () => apiClient<PosBootstrap>(`/pos/bootstrap?outletId=${outletId}`),
    enabled: !!outletId && outletId > 0,
    staleTime: STALE_TIME.tables,
  })

  useEffect(() => {
    if (!query.data || !outletId) return
    const { outlet, departments, tables, foodCategories, addons } = query.data
    queryClient.setQueryData(queryKeys.outlets.detail(outletId), outlet)
    queryClient.setQueryData(
      queryKeys.outletDepartments.list({ outletId, limit: 100 }),
      asPaginated(departments),
    )
    queryClient.setQueryData(queryKeys.diningTables.list({ outletId, limit: 100 }), asPaginated(tables))
    queryClient.setQueryData(queryKeys.foodCategories.list({ limit: 100 }), asPaginated(foodCategories))
    queryClient.setQueryData(queryKeys.addons.list({ limit: 100 }), asPaginated(addons))
  }, [query.data, outletId, queryClient])

  return query
}

export interface ReservationsBootstrap {
  reservations: PaginatedResponse<Reservation>
  customers: PaginatedResponse<Customer>
  outlets: PaginatedResponse<Outlet>
}

export function useReservationsBootstrap(outletId?: number) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["reservations", "bootstrap", outletId ?? null],
    queryFn: () =>
      apiClient<ReservationsBootstrap>(`/reservations/bootstrap${outletId ? `?outletId=${outletId}` : ""}`),
    staleTime: STALE_TIME.reference,
  })

  useEffect(() => {
    if (!query.data) return
    queryClient.setQueryData(queryKeys.customers.list({ limit: 100 }), query.data.customers)
    queryClient.setQueryData(queryKeys.outlets.list({ limit: 100 }), query.data.outlets)
  }, [query.data, queryClient])

  return query
}

export interface InventoryBootstrap {
  ingredients: PaginatedResponse<Ingredient>
  units: PaginatedResponse<Unit>
  categories: PaginatedResponse<IngredientCategory>
  warehouses: PaginatedResponse<Warehouse>
}

export function useInventoryBootstrap() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["inventory", "bootstrap"],
    queryFn: () => apiClient<InventoryBootstrap>("/inventory/bootstrap"),
    staleTime: STALE_TIME.reference,
  })

  useEffect(() => {
    if (!query.data) return
    const { ingredients, units, categories, warehouses } = query.data
    queryClient.setQueryData(queryKeys.ingredients.list({ limit: 100 }), ingredients)
    queryClient.setQueryData(queryKeys.units.list({ limit: 100 }), units)
    queryClient.setQueryData(queryKeys.ingredientCategories.list({ limit: 100 }), categories)
    queryClient.setQueryData(queryKeys.warehouses.list({ limit: 100 }), warehouses)
  }, [query.data, queryClient])

  return query
}
