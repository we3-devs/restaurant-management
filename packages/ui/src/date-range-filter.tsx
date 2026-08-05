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
}: {
  value: DateRange
  onChange: (value: DateRange) => void
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">From</label>
        <Input
          type="date"
          value={value.dateFrom}
          max={value.dateTo}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">To</label>
        <Input
          type="date"
          value={value.dateTo}
          min={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
        />
      </div>
    </div>
  )
}
