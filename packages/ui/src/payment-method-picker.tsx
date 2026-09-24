"use client"

import { Banknote, CreditCard, Landmark, Receipt } from "lucide-react"

import { cn } from "./cn"
import { ORDER_PAYMENT_METHODS } from "@rms/validators/orders"

const PAYMENT_METHOD_OPTIONS: {
  value: (typeof ORDER_PAYMENT_METHODS)[number]
  label: string
  description: string
  icon: typeof Banknote
}[] = [
  { value: "cash", label: "Cash", description: "Paid at the counter", icon: Banknote },
  { value: "card", label: "Card", description: "Debit / credit card", icon: CreditCard },
  { value: "online", label: "Online", description: "Bank / eSewa / wallet", icon: Landmark },
  { value: "credit", label: "Credit", description: "Charge to customer's tab", icon: Receipt },
]

/**
 * The one "pick how this is being paid" control — a card grid instead of a
 * dropdown so the method is visible at a glance on a counter/tablet. Shared
 * by the per-order checkout panel and the combined table-checkout view so
 * both stay visually and behaviorally identical.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  exclude,
}: {
  value: (typeof ORDER_PAYMENT_METHODS)[number]
  onChange: (method: (typeof ORDER_PAYMENT_METHODS)[number]) => void
  /** Methods to hide — e.g. "credit" on a refund form, which has no original credit charge to reverse. */
  exclude?: (typeof ORDER_PAYMENT_METHODS)[number][]
}) {
  const options = exclude ? PAYMENT_METHOD_OPTIONS.filter((option) => !exclude.includes(option.value)) : PAYMENT_METHOD_OPTIONS
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">Select method</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ value: method, label, description, icon: Icon }) => (
          <button
            key={method}
            type="button"
            onClick={() => onChange(method)}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-colors",
              value === method ? "border-foreground bg-muted/50" : "border-input hover:bg-muted/30",
            )}
          >
            <Icon className="size-4" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
