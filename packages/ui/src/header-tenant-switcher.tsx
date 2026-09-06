"use client"

import { useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { useActiveOutlet } from "@rms/api-client/outlet/active-outlet-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Skeleton } from "./skeleton"

export function HeaderTenantSwitcher() {
  const { activeTenantSlug, setActiveTenantSlug, tenants, isLoadingTenants, isSuperadmin } = useActiveOutlet()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!isSuperadmin || !mounted) return null
  if (isLoadingTenants) return <Skeleton className="h-8 w-44 rounded-md" />

  return (
    <Select value={activeTenantSlug ?? ""} onValueChange={(value) => { if (value) setActiveTenantSlug(value) }}>
      <SelectTrigger className="h-8 w-44 border-none bg-transparent text-sm shadow-none hover:bg-muted">
        <Building2 className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Select tenant" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.slug}>{tenant.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
