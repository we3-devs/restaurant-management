"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
  BellRingIcon,
  Building2Icon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserCogIcon,
} from "lucide-react"

import { useCurrentUser } from "@/lib/auth/current-user-context"
import { usePageTitle } from "@rms/ui/use-page-title"

interface ControlPanelSection {
  slug: string
  href: string
  label: string
  description: string
  icon: LucideIcon
  iconTone: string
  /** Shown when the current user has none of these permissions. */
  permission: string
}

const SECTIONS: ControlPanelSection[] = [
  {
    slug: "positions",
    href: "/dashboard/control-panel/permissions",
    label: "Roles & Permissions",
    description: "Define positions and which modules each one can view or manage",
    icon: ShieldCheckIcon,
    iconTone: "bg-indigo-500/15 text-indigo-500",
    permission: "employees.view",
  },
  {
    slug: "employees",
    href: "/dashboard/control-panel/employees",
    label: "Staff & Assignments",
    description: "Employees, their position, outlet and department assignments",
    icon: UsersRoundIcon,
    iconTone: "bg-emerald-500/15 text-emerald-500",
    permission: "employees.view",
  },
  {
    slug: "outlet-departments",
    href: "/dashboard/control-panel/departments",
    label: "Departments",
    description: "The departments staff get assigned to within each outlet",
    icon: Building2Icon,
    iconTone: "bg-amber-500/15 text-amber-500",
    permission: "outlet-departments.view",
  },
  {
    slug: "users",
    href: "/dashboard/control-panel/users",
    label: "Users",
    description: "Staff login accounts and which position each one holds",
    icon: UserCogIcon,
    iconTone: "bg-sky-500/15 text-sky-500",
    permission: "users.view",
  },
  {
    slug: "shifts",
    href: "/dashboard/staff/shifts",
    label: "Shifts",
    description: "Scheduled shifts and who's assigned to work them",
    icon: CalendarClockIcon,
    iconTone: "bg-rose-500/15 text-rose-500",
    permission: "shifts.view",
  },
  {
    slug: "attendance",
    href: "/dashboard/staff/attendance",
    label: "Attendance",
    description: "Clock-in/out records and attendance requirements",
    icon: ClipboardCheckIcon,
    iconTone: "bg-teal-500/15 text-teal-500",
    permission: "attendance.view",
  },
  {
    slug: "notifications",
    href: "/dashboard/control-panel/notifications",
    label: "Notifications",
    description: "Alert channels, which roles get notified, and sound alerts",
    icon: BellRingIcon,
    iconTone: "bg-cyan-500/15 text-cyan-500",
    permission: "settings.view",
  },
  {
    slug: "settings",
    href: "/dashboard/settings",
    label: "All Settings",
    description: "Business, POS, kitchen, inventory and every other config area",
    icon: SettingsIcon,
    iconTone: "bg-violet-500/15 text-violet-500",
    permission: "settings.view",
  },
]

export default function ControlPanelPage() {
  const { permissions } = useCurrentUser()
  // The page itself has no single gate — each card is shown only if the
  // user holds the permission that section's own page already requires, so
  // this hub never links anywhere a user couldn't already navigate to
  // directly.
  const visibleSections = SECTIONS.filter((section) => permissions.includes(section.permission))

  usePageTitle("Control Panel")

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Control panel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles, permissions, staff assignments and workspace configuration — all in one place.
          </p>
        </div>
      </div>

      {visibleSections.length === 0 ? (
        <p className="text-sm text-muted-foreground">You do not have access to any control panel sections.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleSections.map((section) => (
            <Link key={section.slug} href={section.href} className="group">
              <div className="relative flex h-full min-h-48 flex-col rounded-lg border border-border p-5 transition-colors duration-150 group-hover:bg-accent/40 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-md ${section.iconTone}`}>
                    <section.icon className="size-5" />
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <div className="mt-auto space-y-1.5 pt-8">
                  <h3 className="text-base font-semibold tracking-tight">{section.label}</h3>
                  <p className="text-sm leading-5 text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
