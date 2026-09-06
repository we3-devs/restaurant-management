import { Input } from "./input"

export interface DateRange {
  dateFrom: string
  dateTo: string
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
}: {
  value: DateRange
  onChange: (value: DateRange) => void
  compact?: boolean
}) {
  return (
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
  )
}
