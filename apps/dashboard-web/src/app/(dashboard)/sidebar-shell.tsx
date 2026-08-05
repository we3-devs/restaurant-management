"use client"

import { useState } from "react"
import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"
import { DashboardNav } from "./dashboard-nav"

/**
 * Owns the sidebar's collapsed/expanded width and the icon-rail nav swap —
 * lifted into its own client component because layout.tsx is a server
 * component (it awaits getCurrentUser()) and collapsing needs real React
 * state, not just a CSS class toggle (the rail renders fundamentally
 * different content than the full nav, see DashboardNav's `collapsed` prop).
 */
export function SidebarShell({
  permissions,
  isSuperadmin,
  roleSlugs,
  children,
}: {
  permissions: string[]
  isSuperadmin: boolean
  roleSlugs: string[]
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const [forceOpenGroup, setForceOpenGroup] = useState<string | null>(null)

  function expandGroup(groupLabel: string) {
    setForceOpenGroup(groupLabel)
    setCollapsed(false)
  }

  return (
    <>
      <aside
        id="dashboard-sidebar"
        className={`fixed h-screen inset-y-0 left-0 z-40 shrink-0 -translate-x-full border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 max-lg:shadow-xl lg:static lg:translate-x-0 ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </span>
          {!collapsed && <span className="font-semibold tracking-tight text-sidebar-foreground">RMS</span>}
        </div>
        <div className="h-[calc(100%-3.5rem-3rem)] ">
          <DashboardNav
            permissions={permissions}
            isSuperadmin={isSuperadmin}
            roleSlugs={roleSlugs}
            collapsed={collapsed}
            onExpandGroup={expandGroup}
            forceOpenGroup={forceOpenGroup}
          />
        </div>
        <div className="flex w-full h-12 items-center justify-center border-t border-sidebar-border">
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
