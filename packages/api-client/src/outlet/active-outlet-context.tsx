"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAssignedOutletDepartments } from "../hooks/use-outlet-departments"
import type { OutletDepartment } from "../hooks/use-outlet-departments"
import { useAssignedOutlets, useOutlets, useSuperadminTenants, type Outlet, type SuperadminTenant } from "../hooks/use-outlets"
import { useCurrentUser } from "@rms/auth/current-user-context"

const ACTIVE_OUTLET_STORAGE_KEY = "active-outlet-id"
const ACTIVE_TENANT_STORAGE_KEY = "active-tenant-slug"
const ACTIVE_DEPARTMENT_STORAGE_KEY = "active-department-id"
const ALL_OUTLETS_SENTINEL = "all"

function readStoredId(key: string): number | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(key)
  if (!stored) return null
  const n = Number(stored)
  return Number.isFinite(n) ? n : null
}

/** Distinguishes "never chosen yet" (null, auto-select kicks in) from "explicitly chose All Outlets" (also null, but sticky). */
function readStoredOutletWasAll(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ACTIVE_OUTLET_STORAGE_KEY) === ALL_OUTLETS_SENTINEL
}

interface ActiveOutletContextValue {
  outletId: number | null
  setOutletId: (id: number | null) => void
  outlets: Outlet[]
  isLoadingOutlets: boolean
  /** Superadmins always get the full picker; regular users only when they have more than one assigned outlet. */
  showOutletPicker: boolean
  /** Only superadmins may pick "All Outlets" — every other role must always have one specific outlet active. */
  isSuperadmin: boolean
  tenants: SuperadminTenant[]
  activeTenantSlug: string | null
  setActiveTenantSlug: (slug: string) => void
  isLoadingTenants: boolean

  departmentId: number | null
  setDepartmentId: (id: number | null) => void
  departments: OutletDepartment[]
  isLoadingDepartments: boolean
  showDepartmentPicker: boolean
}

const ActiveOutletContext = createContext<ActiveOutletContextValue | null>(null)

/**
 * Single source of truth for "which outlet/department is active" across POS,
 * Floor, Service, Kitchen and notifications.
 *
 * Superadmins list every outlet via GET /outlets. Everyone else never calls
 * that endpoint (it requires `outlets.view`, which a cashier has no reason to
 * hold) — they get exactly their assigned outlets from GET /outlets/assigned,
 * which is driven by assignments, not permissions. One assigned outlet means
 * the picker never even renders; the same auto-select/hide-picker rule
 * applies one level down to departments once an outlet is chosen.
 */
export function ActiveOutletProvider({ children }: { children: React.ReactNode }) {
  const { isSuperadmin } = useCurrentUser()
  const queryClient = useQueryClient()
  const tenantsQuery = useSuperadminTenants({ enabled: isSuperadmin })
  const tenants = tenantsQuery.data ?? []
  const [activeTenantSlug, setActiveTenantSlugState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY),
  )

  useEffect(() => {
    if (!isSuperadmin || tenantsQuery.isLoading || tenants.length === 0) return
    const selected = tenants.some((tenant) => tenant.slug === activeTenantSlug)
    if (!selected) {
      setActiveTenantSlugState(tenants[0].slug)
      localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenants[0].slug)
      setIsAllOutlets(true)
      setOutletIdState(null)
    }
  }, [activeTenantSlug, isSuperadmin, tenants, tenantsQuery.isLoading])

  function setActiveTenantSlug(slug: string) {
    if (!tenants.some((tenant) => tenant.slug === slug)) return
    setActiveTenantSlugState(slug)
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, slug)
    setIsAllOutlets(true)
    setOutletIdState(null)
    // Tenant is part of the server-side request context, so cached results
    // from the previous tenant must never be shown after switching.
    void queryClient.invalidateQueries()
  }

  useEffect(() => {
    if (activeTenantSlug) localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, activeTenantSlug)
  }, [activeTenantSlug])

  const allOutletsQuery = useOutlets({ limit: 100 }, { enabled: isSuperadmin && activeTenantSlug !== null })
  const assignedOutletsQuery = useAssignedOutlets({ enabled: !isSuperadmin })

  const outlets = useMemo(
    () => (isSuperadmin ? (allOutletsQuery.data?.data ?? []) : (assignedOutletsQuery.data ?? [])),
    [isSuperadmin, allOutletsQuery.data, assignedOutletsQuery.data],
  )
  const isLoadingOutlets = isSuperadmin ? allOutletsQuery.isLoading : assignedOutletsQuery.isLoading
  const outletLogoutStarted = useRef(false)
  // Regular users select among their assigned outlets from Profile. The
  // shared header never exposes an "all" or null option for them.
  const showOutletPicker = isSuperadmin

  const [outletId, setOutletIdState] = useState<number | null>(() => readStoredId(ACTIVE_OUTLET_STORAGE_KEY))
  // Tracks an explicit "All Outlets" pick separately from outletId, since
  // both are represented as `null` — without this, the auto-select effect
  // below couldn't tell "never chosen yet" from "chose All on purpose" and
  // would keep bouncing the user back to a single outlet.
  const [isAllOutlets, setIsAllOutlets] = useState<boolean>(() =>
    isSuperadmin && activeTenantSlug !== null ? true : readStoredOutletWasAll(),
  )

  function setOutletId(id: number | null) {
    // "All Outlets" is a superadmin-only concept. A non-superadmin can still
    // switch between their own assigned outlets (from their profile page),
    // just never to "all" — an out-of-assignment id is coerced onto their
    // first assigned outlet instead.
    if (!isSuperadmin) {
      const requested = id !== null && outlets.some((o) => o.id === id) ? id : (outlets[0]?.id ?? null)
      setIsAllOutlets(false)
      setOutletIdState(requested)
      return
    }
    setIsAllOutlets(id === null)
    setOutletIdState(id)
  }

  // Superadmins may remain on "All Outlets". For regular users, recover a
  // missing/stale selection to the first assigned outlet; there is no valid
  // regular-user state with a null outlet once assignments have loaded.
  useEffect(() => {
    if (isLoadingOutlets || outlets.length === 0) return
    if (!isSuperadmin) {
      const stillValid = outletId !== null && outlets.some((o) => o.id === outletId)
      if (!stillValid) setOutletIdState(outlets[0].id)
      return
    }
    if (isAllOutlets) return
    const stillValid = outletId !== null && outlets.some((o) => o.id === outletId)
    if (!stillValid) setOutletIdState(outlets[0].id)
  }, [outlets, isLoadingOutlets, outletId, isAllOutlets, isSuperadmin])

  useEffect(() => {
    if (isSuperadmin || isLoadingOutlets || assignedOutletsQuery.isError || outletLogoutStarted.current) return
    if (outlets.length > 0) return

    outletLogoutStarted.current = true
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(ACTIVE_OUTLET_STORAGE_KEY)
        window.location.replace("/login")
      }
    })
  }, [assignedOutletsQuery.isError, isLoadingOutlets, isSuperadmin, outletId, outlets])

  useEffect(() => {
    if (isAllOutlets) {
      localStorage.setItem(ACTIVE_OUTLET_STORAGE_KEY, ALL_OUTLETS_SENTINEL)
    } else if (outletId !== null) {
      localStorage.setItem(ACTIVE_OUTLET_STORAGE_KEY, String(outletId))
    } else {
      localStorage.removeItem(ACTIVE_OUTLET_STORAGE_KEY)
    }
  }, [outletId, isAllOutlets])

  // Departments for the active outlet — same permission-free, assignment-driven
  // endpoint for every role; it already narrows to the user's own department(s)
  // server-side and only falls back to "every department at this outlet" for
  // superadmins/globally-scoped users.
  const departmentsQuery = useAssignedOutletDepartments(outletId)
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data])
  const isLoadingDepartments = departmentsQuery.isLoading
  const showDepartmentPicker = departments.length > 1

  const regularUserHasValidOutlet =
    isSuperadmin || (!isLoadingOutlets && outletId !== null && outlets.some((outlet) => outlet.id === outletId))

  const [departmentId, setDepartmentId] = useState<number | null>(() =>
    readStoredId(ACTIVE_DEPARTMENT_STORAGE_KEY),
  )

  useEffect(() => {
    if (isLoadingDepartments) return
    if (departments.length === 0) {
      if (departmentId !== null) setDepartmentId(null)
      return
    }
    const stillValid = departmentId !== null && departments.some((d) => d.id === departmentId)
    if (!stillValid) setDepartmentId(departments[0].id)
  }, [departments, isLoadingDepartments, departmentId])

  useEffect(() => {
    if (departmentId !== null) {
      localStorage.setItem(ACTIVE_DEPARTMENT_STORAGE_KEY, String(departmentId))
    } else {
      localStorage.removeItem(ACTIVE_DEPARTMENT_STORAGE_KEY)
    }
  }, [departmentId])

  return (
    <ActiveOutletContext.Provider
      value={{
        outletId,
        setOutletId,
        outlets,
        isLoadingOutlets,
        showOutletPicker,
        isSuperadmin,
        tenants,
        activeTenantSlug,
        setActiveTenantSlug,
        isLoadingTenants: tenantsQuery.isLoading,
        departmentId,
        setDepartmentId,
        departments,
        isLoadingDepartments,
        showDepartmentPicker,
      }}
    >
      {regularUserHasValidOutlet ? children : null}
    </ActiveOutletContext.Provider>
  )
}

export function useActiveOutlet(): ActiveOutletContextValue {
  const ctx = useContext(ActiveOutletContext)
  if (!ctx) {
    throw new Error("useActiveOutlet must be used within an ActiveOutletProvider")
  }
  return ctx
}
