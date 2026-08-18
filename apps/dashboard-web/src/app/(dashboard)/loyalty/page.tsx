"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatGridSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useSettingsCategory, type LoyaltySettings } from "@/hooks/use-settings"

export default function LoyaltyPage() {
  const { permissions, isSuperadmin } = useCurrentUser()
  const canView = isSuperadmin || permissions.includes("loyalty.view")

  const { data, isLoading } = useSettingsCategory<LoyaltySettings>("loyalty")
  const showSkeleton = useDelayedLoading(isLoading)

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Loyalty Program</h1>
        <Button variant="outline" render={<Link href="/settings/loyalty" />}>
          Edit rules
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Customers earn points on purchases and can redeem them for discounts. The rules below control how points are
        earned, redeemed and expired.
      </p>

      {showSkeleton ? (
        <StatGridSkeleton count={6} className="sm:grid-cols-3 xl:grid-cols-3" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Current rules</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Points per currency unit</p>
              <p className="font-medium">{data?.pointsPerCurrencyUnit ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Minimum redemption points</p>
              <p className="font-medium">{data?.minRedemptionPoints ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max redemption %</p>
              <p className="font-medium">{data?.maxRedemptionPercent ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Point expiry (days)</p>
              <p className="font-medium">{data?.pointExpiryDays ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Welcome bonus points</p>
              <p className="font-medium">{data?.welcomeBonusPoints ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Birthday bonus points</p>
              <p className="font-medium">{data?.birthdayBonusPoints ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/loyalty/customers">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Customer accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View customer point balances and adjust points manually.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/loyalty/transactions">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Browse the full history of point earns, redemptions, adjustments and expiries.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
