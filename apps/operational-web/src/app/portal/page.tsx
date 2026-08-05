import Link from "next/link"
import { verifyCustomerSession } from "@rms/auth/customer-dal"
import { customerBackendFetch } from "@rms/auth/server/customer-backend-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@rms/ui/card"

interface LoyaltySummary {
  currentPoints: number
  tier: string | null
}

export default async function CustomerPortalHomePage() {
  const customer = await verifyCustomerSession()
  const loyaltyResponse = await customerBackendFetch("/customer-portal/loyalty")
  const loyalty = loyaltyResponse.ok ? ((await loyaltyResponse.json()) as LoyaltySummary) : null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Welcome back{customer.phone || customer.email ? "" : ""}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Loyalty points</CardTitle>
          <CardDescription>{loyalty?.tier ?? "No tier yet"}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{loyalty?.currentPoints ?? 0} pts</p>
        </CardContent>
      </Card>

      <nav className="grid grid-cols-2 gap-3">
        <Link href="/portal/orders" className="rounded-lg border p-4 hover:bg-muted">
          Order history
        </Link>
        <Link href="/portal/loyalty" className="rounded-lg border p-4 hover:bg-muted">
          Loyalty details
        </Link>
        <Link href="/portal/profile" className="rounded-lg border p-4 hover:bg-muted">
          Profile & preferences
        </Link>
      </nav>
    </div>
  )
}
