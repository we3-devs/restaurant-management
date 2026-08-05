import { verifyCustomerSession } from "@rms/auth/customer-dal"
import { customerBackendFetch } from "@rms/auth/server/customer-backend-client"
import type { PaginatedResponse } from "@rms/api-client/types"
import type { LoyaltyAccount } from "@rms/api-client/hooks/use-customer-portal"

interface LoyaltyTransaction {
  id: number
  type: string
  points: number
  balanceAfter: number
  createdAt: string
}

export default async function CustomerLoyaltyPage() {
  await verifyCustomerSession()
  const [accountResponse, historyResponse] = await Promise.all([
    customerBackendFetch("/customer-portal/loyalty"),
    customerBackendFetch("/customer-portal/loyalty/history"),
  ])
  const account: LoyaltyAccount | null = accountResponse.ok ? await accountResponse.json() : null
  const history: PaginatedResponse<LoyaltyTransaction> = historyResponse.ok
    ? await historyResponse.json()
    : { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Loyalty</h1>
      <div className="rounded-lg border p-4">
        <p className="text-2xl font-semibold">{account?.currentPoints ?? 0} pts</p>
        <p className="text-sm text-muted-foreground">
          Lifetime earned {account?.lifetimeEarned ?? 0} · redeemed {account?.lifetimeRedeemed ?? 0} · expiring
          soon {account?.expiringPoints ?? 0}
        </p>
      </div>

      <h2 className="font-medium">History</h2>
      <ul className="flex flex-col gap-2">
        {history.data.map((tx) => (
          <li key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium capitalize">{tx.type.replace("_", " ")}</p>
              <p className="text-sm text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className={tx.points >= 0 ? "text-emerald-600" : "text-destructive"}>
                {tx.points >= 0 ? "+" : ""}
                {tx.points}
              </p>
              <p className="text-sm text-muted-foreground">bal {tx.balanceAfter}</p>
            </div>
          </li>
        ))}
        {history.data.length === 0 && <p className="text-muted-foreground">No loyalty activity yet.</p>}
      </ul>
    </div>
  )
}
