import { Input } from "./input"
import { Button } from "./button"

export interface DateRange {
  dateFrom: string
  dateTo: string
}

type QuickRange = "today" | "yesterday" | "week"

function localIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function quickRange(range: QuickRange): DateRange {
  const today = new Date()
  const dateTo = localIsoDate(today)

  if (range === "today") return { dateFrom: dateTo, dateTo }

  if (range === "yesterday") {
    today.setDate(today.getDate() - 1)
    const yesterday = localIsoDate(today)
    return { dateFrom: yesterday, dateTo: yesterday }
  }

  today.setDate(today.getDate() - 6)
  return { dateFrom: localIsoDate(today), dateTo }
}

/**
 * Plain native date inputs rather than a hand-rolled calendar+popover — no
 * date library is installed in this project, and native <input type="date">
 * already gives a full calendar picker per-browser for free. Keeps this
 * addition dependency-free and consistent with the rest of the form inputs.
 */
export function DateRangeFilter({
  value,
  onChange,
  compact = false,
  showQuickRanges = false,
}: {
  value: DateRange
  onChange: (value: DateRange) => void
  compact?: boolean
  /** Displays Today, Yesterday, and Last 7 days shortcuts above the inputs. */
  showQuickRanges?: boolean
}) {
  return (
    <div className={showQuickRanges ? "flex items-center gap-2" : undefined}>
      {showQuickRanges && (
        <div className="flex items-center gap-1" aria-label="Quick date ranges">
          {(["today", "yesterday", "week"] as const).map((range) => {
            const nextRange = quickRange(range)
            const label = range === "week" ? "Last 7 days" : range[0].toUpperCase() + range.slice(1)
            const selected = value.dateFrom === nextRange.dateFrom && value.dateTo === nextRange.dateTo

            return <Button key={range} type="button" variant={selected ? "secondary" : "outline"} size="xs" aria-pressed={selected} onClick={() => onChange(nextRange)}>{label}</Button>
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className={compact ? "flex items-center gap-1.5" : "space-y-1.5"}>
          <label className={compact ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium"}>From</label>
          <Input
            type="date"
            className={compact ? "h-8 w-32 border-border/60 bg-background/70 px-2 text-xs" : undefined}
            value={value.dateFrom}
            max={value.dateTo}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          />
        </div>
        <div className={compact ? "flex items-center gap-1.5" : "space-y-1.5"}>
          <label className={compact ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium"}>To</label>
          <Input
            type="date"
            className={compact ? "h-8 w-32 border-border/60 bg-background/70 px-2 text-xs" : undefined}
            value={value.dateTo}
            min={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
