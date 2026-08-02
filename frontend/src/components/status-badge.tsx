import type { VariantProps } from "class-variance-authority"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

// Whole-token match (underscores count as word chars in JS regex, so
// "out_of_stock" is one token and "unpaid" never false-matches "paid").
const SUCCESS = /\b(completed|approved|paid|confirmed|served|accepted|active|resolved|closed|received|available|seated|success|present|adjusted)\b/i
const DESTRUCTIVE = /\b(cancelled|canceled|rejected|void|out_of_stock|failed|no_show|overdue|expired|unpaid|absent)\b/i
const WARNING = /\b(pending|pending_approval|draft|open|waiting|low_stock|partial|partially_ready|partially_served|held|due|reserved|late|inactive|cleaning)\b/i
const INFO = /\b(preparing|in_progress|processing|sent|sent_to_kitchen|transit|occupied|billing|ready|partially_received)\b/i

function statusVariant(status: string): BadgeVariant {
  if (SUCCESS.test(status)) return "success"
  if (DESTRUCTIVE.test(status)) return "destructive"
  if (WARNING.test(status)) return "warning"
  if (INFO.test(status)) return "info"
  return "secondary"
}

/** Maps any of the app's many status vocabularies (order/kitchen/reservation/payment/procurement/stock/table) to a consistent semantic color, so "completed"/"paid"/"approved" always read green, "cancelled"/"rejected" always red, etc. Falls back to a neutral badge for anything unrecognized. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusVariant(status)} className={cn("capitalize", className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
