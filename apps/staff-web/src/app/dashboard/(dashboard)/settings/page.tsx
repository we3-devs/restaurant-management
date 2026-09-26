"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
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
  iconTone: string
}[] = [
  { slug: "business", label: "Business", description: "Identity, contact details and operating hours", icon: Building2Icon, iconTone: "bg-sky-500/15 text-sky-500" },
  { slug: "pos", label: "Point of sale", description: "Receipts, numbering and payment defaults", icon: ReceiptTextIcon, iconTone: "bg-violet-500/15 text-violet-500" },
  { slug: "kitchen", label: "Kitchen", description: "Ticket timing, routing and priorities", icon: ChefHatIcon, iconTone: "bg-orange-500/15 text-orange-500" },
  { slug: "inventory", label: "Inventory", description: "Stock policy, reorder and costing rules", icon: BoxesIcon, iconTone: "bg-emerald-500/15 text-emerald-500" },
  { slug: "reservation", label: "Reservations", description: "Booking windows, buffers and cancellations", icon: CalendarDaysIcon, iconTone: "bg-rose-500/15 text-rose-500" },
  { slug: "loyalty", label: "Loyalty", description: "Points, redemption and bonus rules", icon: GiftIcon, iconTone: "bg-amber-500/15 text-amber-500" },
  { slug: "appearance", label: "Appearance", description: "Branding, logo and receipt styling", icon: PaletteIcon, iconTone: "bg-fuchsia-500/15 text-fuchsia-500" },
]

export default function SettingsPage() {
  const { permissions } = useCurrentUser()
  const canView = permissions.includes("settings.view")
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
        <CardGridSkeleton count={7} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link key={category.slug} href={`/dashboard/settings/${category.slug}`} className="group">
              <div className="relative flex h-full min-h-48 flex-col rounded-lg border border-border p-5 transition-colors duration-150 group-hover:bg-accent/40 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-md ${category.iconTone}`}><category.icon className="size-5" /></span>
                  <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <div className="mt-auto space-y-1.5 pt-8">
                  <h3 className="text-base font-semibold tracking-tight">{category.label}</h3>
                  <p className="text-sm leading-5 text-muted-foreground">{category.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
