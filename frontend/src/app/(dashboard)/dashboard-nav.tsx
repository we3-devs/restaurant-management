"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { visibleNavGroups } from "./nav-items"

interface DashboardNavProps {
  permissions: string[]
  isSuperadmin: boolean
  /** Icon-only rail mode — each group renders as a single icon; clicking one expands the sidebar via onExpandGroup. */
  collapsed?: boolean
  onExpandGroup?: (groupLabel: string) => void
  /** Set right after expanding from the icon rail, so the group that was clicked opens automatically instead of whichever one matches the current route. */
  forceOpenGroup?: string | null
}

interface NavLink {
  href: string
  label: string
}

interface NavGroup {
  label: string
  icon: LucideIcon
  links: NavLink[]
}

export function DashboardNav({
  permissions,
  isSuperadmin,
  collapsed = false,
  onExpandGroup,
  forceOpenGroup,
}: DashboardNavProps) {
  const pathname = usePathname()
  const groups: NavGroup[] = visibleNavGroups(permissions, isSuperadmin)

  const activeGroupLabel = groups.find((group) =>
    group.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)),
  )?.label

  if (collapsed) {
    return (
      <nav className="flex h-full flex-col items-center gap-1 overflow-y-auto px-2 py-4">
        {groups.map((group) => {
          const Icon = group.icon
          const active = group.label === activeGroupLabel
          return (
            <button
              key={group.label}
              type="button"
              title={group.label}
              aria-label={`Expand ${group.label}`}
              onClick={() => onExpandGroup?.(group.label)}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" />
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <NavSection
          key={group.label}
          group={group}
          pathname={pathname}
          defaultOpen={group.label === activeGroupLabel}
          forceOpen={group.label === forceOpenGroup}
        />
      ))}
    </nav>
  )
}

function NavSection({
  group,
  pathname,
  defaultOpen,
  forceOpen,
}: {
  group: NavGroup
  pathname: string
  defaultOpen: boolean
  forceOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || group.links.length <= 3)
  const Icon = group.icon

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  return (
    <div className="flex flex-col" data-nav-group={group.label}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l border-border/60 pl-3.5">
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/10 font-medium text-primary before:absolute before:top-1/2 before:-left-3.75 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
