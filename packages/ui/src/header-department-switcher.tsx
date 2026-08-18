"use client"

import { useEffect, useState } from "react"
import { ChefHatIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Skeleton } from "./skeleton"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"

/**
 * Global department/kitchen switcher in the header, next to the outlet
 * switcher — same ActiveOutletProvider the Kitchen Display reads its default
 * station from. Superadmins get every department at the active outlet (not
 * just an assigned one), so they can jump into any kitchen/bar/counter to
 * check on it. Hidden when there's zero or one department to pick from.
 */
export function HeaderDepartmentSwitcher() {
  const { departmentId, setDepartmentId, departments, showDepartmentPicker, isLoadingDepartments } =
    useActiveOutlet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  if (showDepartmentPicker && isLoadingDepartments) return <Skeleton className="h-8 w-40 rounded-md" />
  if (!showDepartmentPicker) return null

  return (
    <Select
      value={departmentId ? String(departmentId) : ""}
      onValueChange={(v) => v && setDepartmentId(Number(v))}
    >
      <SelectTrigger className="h-8 w-40 border-none bg-transparent text-sm shadow-none hover:bg-muted">
        <ChefHatIcon className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Select kitchen" />
      </SelectTrigger>
      <SelectContent>
        {departments.map((department) => (
          <SelectItem key={department.id} value={String(department.id)}>
            {department.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
