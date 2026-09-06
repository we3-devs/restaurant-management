"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
  BellRingIcon,
  BoxesIcon,
  Building2Icon,
  CalendarDaysIcon,
  ChefHatIcon,
  GiftIcon,
  PaletteIcon,
  ReceiptTextIcon,
  SparklesIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { CardGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useAllSettings } from "@/hooks/use-settings"
import { usePageTitle } from "@rms/ui/use-page-title"

const CATEGORIES: {
  slug: string
  label: string
  description: string
  icon: LucideIcon
  tone: string
  iconTone: string
}[] = [
  { slug: "business", label: "Business", description: "Identity, contact details and operating hours", icon: Building2Icon, tone: "from-sky-500/15 via-sky-500/5", iconTone: "bg-sky-500/15 text-sky-500" },
  { slug: "pos", label: "Point of sale", description: "Receipts, numbering and payment defaults", icon: ReceiptTextIcon, tone: "from-violet-500/15 via-violet-500/5", iconTone: "bg-violet-500/15 text-violet-500" },
  { slug: "kitchen", label: "Kitchen", description: "Ticket timing, routing and priorities", icon: ChefHatIcon, tone: "from-orange-500/15 via-orange-500/5", iconTone: "bg-orange-500/15 text-orange-500" },
  { slug: "inventory", label: "Inventory", description: "Stock policy, reorder and costing rules", icon: BoxesIcon, tone: "from-emerald-500/15 via-emerald-500/5", iconTone: "bg-emerald-500/15 text-emerald-500" },
  { slug: "reservation", label: "Reservations", description: "Booking windows, buffers and cancellations", icon: CalendarDaysIcon, tone: "from-rose-500/15 via-rose-500/5", iconTone: "bg-rose-500/15 text-rose-500" },
  { slug: "loyalty", label: "Loyalty", description: "Points, redemption and bonus rules", icon: GiftIcon, tone: "from-amber-500/15 via-amber-500/5", iconTone: "bg-amber-500/15 text-amber-500" },
  { slug: "notifications", label: "Notifications", description: "Alert channels and operational thresholds", icon: BellRingIcon, tone: "from-cyan-500/15 via-cyan-500/5", iconTone: "bg-cyan-500/15 text-cyan-500" },
  { slug: "appearance", label: "Appearance", description: "Branding, logo and receipt styling", icon: PaletteIcon, tone: "from-fuchsia-500/15 via-fuchsia-500/5", iconTone: "bg-fuchsia-500/15 text-fuchsia-500" },
]

export default function SettingsPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("settings.view")
  const { isLoading } = useAllSettings()
  const showSkeleton = useDelayedLoading(isLoading)

  usePageTitle("Settings")

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div><h2 className="text-lg font-semibold tracking-tight">Configuration areas</h2><p className="mt-1 text-sm text-muted-foreground">Choose a section to manage its defaults.</p></div>
        <span className="hidden text-xs text-muted-foreground sm:block">Changes apply across your workspace</span>
      </div>

      {showSkeleton ? (
        <CardGridSkeleton count={8} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link key={category.slug} href={`/dashboard/settings/${category.slug}`} className="group">
              <div className={`relative flex h-full min-h-52 flex-col overflow-hidden rounded-2xl border bg-gradient-to-br ${category.tone} to-card p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-lg group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-ring`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-11 items-center justify-center rounded-xl ${category.iconTone}`}><category.icon className="size-5" /></span>
                  <span className="flex size-8 items-center justify-center rounded-full border bg-background/50 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"><ArrowRightIcon className="size-4" /></span>
                </div>
                <div className="mt-auto space-y-2 pt-8">
                  <h3 className="text-base font-semibold tracking-tight">{category.label}</h3>
                  <p className="text-sm leading-5 text-muted-foreground">{category.description}</p>
                </div>
                <div className="absolute right-5 bottom-5 h-px w-12 bg-border transition-all duration-300 group-hover:w-20 group-hover:bg-primary/60" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
