"use client"

import * as React from "react"
import { ResponsiveContainer } from "recharts"
import { cn } from "./cn"

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string; theme?: { light?: string; dark?: string } }>

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colors = Object.entries(config).flatMap(([key, value]) => {
    const rules: string[] = []
    if (value.color) rules.push(`[data-chart=${id}] { --color-${key}: ${value.color}; }`)
    if (value.theme?.light) rules.push(`.light [data-chart=${id}] { --color-${key}: ${value.theme.light}; }`)
    if (value.theme?.dark) rules.push(`.dark [data-chart=${id}] { --color-${key}: ${value.theme.dark}; }`)
    return rules
  })
  return <style dangerouslySetInnerHTML={{ __html: colors.join("\n") }} />
}

export function ChartContainer({ id = "chart", config, className, children }: { id?: string; config: ChartConfig; className?: string; children: React.ReactNode }) {
  return <div data-chart={id} className={cn("flex h-full w-full justify-center text-xs", className)}><ChartStyle id={id} config={config} /><ResponsiveContainer>{children}</ResponsiveContainer></div>
}

export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: unknown; color?: string; stroke?: string; fill?: string }[]; label?: React.ReactNode }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      {payload.map((entry, index) => {
        const color = entry.color ?? entry.stroke ?? entry.fill
        return (
          <p key={`${entry.name ?? "value"}-${index}`} className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? "currentColor", opacity: color ? 1 : 0.35 }} />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-popover-foreground">{typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "—")}</span>
          </p>
        )
      })}
    </div>
  )
}
