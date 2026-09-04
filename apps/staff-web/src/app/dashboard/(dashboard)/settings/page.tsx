"use client"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useAllSettings } from "@/hooks/use-settings"
import { usePageTitle } from "@rms/ui/use-page-title"

const CATEGORIES: { slug: string; label: string; description: string }[] = [
  { slug: "business", label: "Business", description: "Restaurant identity, contact info and hours" },
  { slug: "pos", label: "POS", description: "Receipts, service charge and tax defaults" },
  { slug: "kitchen", label: "Kitchen", description: "Ticket timeouts, routing and recall limits" },
  { slug: "inventory", label: "Inventory", description: "Stock policy, reorder and costing method" },
  { slug: "reservation", label: "Reservation", description: "Duration, buffer and cancellation window" },
  { slug: "loyalty", label: "Loyalty", description: "Points, redemption and bonus rules" },
  { slug: "notifications", label: "Notifications", description: "Email, SMS and push alert thresholds" },
  { slug: "appearance", label: "Appearance", description: "Branding, logo and receipt styling" },
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
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      {showSkeleton ? (
        <CardGridSkeleton count={8} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link key={category.slug} href={`/dashboard/settings/${category.slug}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{category.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
