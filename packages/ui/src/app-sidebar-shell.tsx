"use client"

import { useState } from "react"
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"

import { useBranding } from "@rms/api-client/hooks/use-branding"

import { Button } from "./button"
import { useSidebarCollapsed } from "./use-sidebar-collapsed"
import { AppSidebarNav, type NavGroup } from "./app-sidebar-nav"

/**
 * Owns the sidebar's collapsed/expanded width and the icon-rail nav swap —
 * lifted into its own client component because layout.tsx is a server
 * component (it awaits getCurrentUser()) and collapsing needs real React
 * state, not just a CSS class toggle (the rail renders fundamentally
 * different content than the full nav, see AppSidebarNav's `collapsed` prop).
 */
export function AppSidebarShell({
  groups,
  children,
}: {
  groups: NavGroup[]
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const branding = useBranding()
  const name = branding.restaurantName ?? "Restra"
  const [forceOpenGroup, setForceOpenGroup] = useState<string | null>(null)

  function expandGroup(groupLabel: string) {
    setForceOpenGroup(groupLabel)
    setCollapsed(false)
  }

  return (
    <>
      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 max-lg:shadow-xl lg:sticky lg:translate-x-0 ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-supplied
            // host; next/image would need it declared in remotePatterns up front.
            <img
              src={branding.logoUrl}
              alt={name}
              className="size-7 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <img src="/icons/logo.jpg" alt={name} className="size-7 shrink-0 rounded-lg object-contain"/>
          )} 
          {!collapsed && (
            <span className="truncate font-semibold tracking-tight text-sidebar-foreground">
              {name}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <AppSidebarNav
            groups={groups}
            collapsed={collapsed}
            onExpandGroup={expandGroup}
            forceOpenGroup={forceOpenGroup}
          />
        </div>
        <div className="flex h-12 w-full shrink-0 items-center justify-center border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-full w-full p-0 overflow-y-hidden"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
          </Button>
        </div>
      </aside>

      <div id="dashboard-sidebar-backdrop" className="fixed inset-0 z-30 hidden bg-black/40 lg:hidden" />

      {children}
    </>
  )
}
