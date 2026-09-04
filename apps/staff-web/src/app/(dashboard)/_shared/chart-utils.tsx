/** Small formatting/rendering helpers shared by the Summary page's period-insight views and any chart widgets elsewhere in the dashboard. */

export function money(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export const CHART_COLOR = "var(--chart-1)"

export function pctChange(current: number, previous: number): number | undefined {
  if (!previous) return undefined
  const rounded = Math.round(((current - previous) / previous) * 1000) / 10
  return rounded === 0 ? 0 : rounded
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          {entry.name}: {money(entry.value)}
        </p>
      ))}
    </div>
  )
}
