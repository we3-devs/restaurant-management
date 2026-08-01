"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { visibleNavGroups } from "./nav-items"

interface DashboardNavProps {
  permissions: string[]
  isSuperadmin: boolean
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

export function DashboardNav({ permissions, isSuperadmin }: DashboardNavProps) {
  const pathname = usePathname()
  const groups: NavGroup[] = visibleNavGroups(permissions, isSuperadmin)

  const activeGroupLabel = groups.find((group) =>
    group.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)),
  )?.label

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <NavSection key={group.label} group={group} pathname={pathname} defaultOpen={group.label === activeGroupLabel} />
      ))}
    </nav>
  )
}

function NavSection({
  group,
  pathname,
  defaultOpen,
}: {
  group: NavGroup
  pathname: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || group.links.length <= 3)
  const Icon = group.icon

  return (
    <div className="flex flex-col">
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
                  "rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
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
