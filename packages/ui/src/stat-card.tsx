import type { LucideIcon } from "lucide-react"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Card, CardContent } from "./card"
import { cn } from "./cn"

export interface StatCardTrend {
  /** Signed percentage vs. the comparison period, e.g. 12.4 or -5.2. */
  value: number
  label?: string
}

/** Standard stat tile: icon + label + big number + optional trend/description. Used across the dashboard and other overview pages. */
export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  description,
}: {
  icon: LucideIcon
  label: string
  value: string
  trend?: StatCardTrend
  description?: string
}) {
  const trendPositive = (trend?.value ?? 0) >= 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon className="size-4.5" />
          </div>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {(trend || description) && (
          <div className="flex items-center gap-1.5 text-xs">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trendPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {trendPositive ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                {Math.abs(trend.value)}%
              </span>
            )}
            {(trend?.label ?? description) && (
              <span className="text-muted-foreground">{trend?.label ?? description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
