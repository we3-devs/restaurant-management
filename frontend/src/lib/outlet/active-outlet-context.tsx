"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAssignedOutletDepartments } from "@/hooks/use-outlet-departments"
import type { OutletDepartment } from "@/hooks/use-outlet-departments"
import { useAssignedOutlets, useOutlets, type Outlet } from "@/hooks/use-outlets"
import { useCurrentUser } from "@/lib/auth/current-user-context"

const ACTIVE_OUTLET_STORAGE_KEY = "active-outlet-id"
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

  const allOutletsQuery = useOutlets({ limit: 100 }, { enabled: isSuperadmin })
  const assignedOutletsQuery = useAssignedOutlets({ enabled: !isSuperadmin })

  const outlets = useMemo(
    () => (isSuperadmin ? (allOutletsQuery.data?.data ?? []) : (assignedOutletsQuery.data ?? [])),
    [isSuperadmin, allOutletsQuery.data, assignedOutletsQuery.data],
  )
  const isLoadingOutlets = isSuperadmin ? allOutletsQuery.isLoading : assignedOutletsQuery.isLoading
  const showOutletPicker = isSuperadmin || outlets.length > 1

  const [outletId, setOutletIdState] = useState<number | null>(() => readStoredId(ACTIVE_OUTLET_STORAGE_KEY))
  // Tracks an explicit "All Outlets" pick separately from outletId, since
  // both are represented as `null` — without this, the auto-select effect
  // below couldn't tell "never chosen yet" from "chose All on purpose" and
  // would keep bouncing the user back to a single outlet.
  const [isAllOutlets, setIsAllOutlets] = useState<boolean>(() => readStoredOutletWasAll())

  function setOutletId(id: number | null) {
    setIsAllOutlets(id === null)
    setOutletIdState(id)
  }

  // Validate the stored/current outlet against what's actually available and
  // auto-select the (only, or first) permitted outlet otherwise — covers
  // first login, a stale outlet from a previous session, and a revoked or
  // deleted outlet. Skipped once the user has explicitly chosen "All".
  useEffect(() => {
    if (isLoadingOutlets || outlets.length === 0 || isAllOutlets) return
    const stillValid = outletId !== null && outlets.some((o) => o.id === outletId)
    if (!stillValid) setOutletIdState(outlets[0].id)
  }, [outlets, isLoadingOutlets, outletId, isAllOutlets])

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
        departmentId,
        setDepartmentId,
        departments,
        isLoadingDepartments,
        showDepartmentPicker,
      }}
    >
      {children}
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
