import { CheckCircle2Icon, CheckIcon, ClockIcon, FlameIcon, XIcon } from "lucide-react"

import type { KitchenTicketItem } from "@/hooks/use-kitchen-tickets"

/** Shared by the desktop KDS board and the staff mobile kitchen screen. */
export function ItemStatusIcon({ status, className = "size-3.5" }: { status: KitchenTicketItem["status"]; className?: string }) {
  switch (status) {
    case "sent_to_kitchen":
      return <ClockIcon className={`${className} shrink-0 text-muted-foreground`} />
    case "preparing":
      return <FlameIcon className={`${className} shrink-0 text-amber-500`} />
    case "ready":
      return <CheckCircle2Icon className={`${className} shrink-0 text-emerald-500`} />
    case "served":
      return <CheckIcon className={`${className} shrink-0 text-emerald-600`} />
    case "cancelled":
      return <XIcon className={`${className} shrink-0 text-destructive`} />
  }
}
