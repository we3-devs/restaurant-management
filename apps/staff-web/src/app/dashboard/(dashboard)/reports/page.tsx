"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/lib/auth/current-user-context"
import { usePageTitle } from "@rms/ui/use-page-title"
import { REPORT_GROUPS } from "./report-catalog"

/** Index for the reports section — every report is its own page under /dashboard/reports/<slug>. */
export default function ReportsPage() {
  const { permissions } = useCurrentUser()
  const [filter, setFilter] = useState("")

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return REPORT_GROUPS
      // The Staff group needs `staff-reports` on top of the baseline
      // `reports.view` that gates this page — hide it rather than offer
      // links that answer 403.
      .filter((group) => !group.permission || permissions.includes(group.permission))
      .map((group) => ({
        ...group,
        reports: term
          ? group.reports.filter((report) => `${report.label} ${report.description}`.toLowerCase().includes(term))
          : group.reports,
      }))
      .filter((group) => group.reports.length > 0)
  }, [filter, permissions])

  usePageTitle("Reports")

  return (
    <div className="page-shell space-y-7">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
        <p className="text-sm text-muted-foreground">Pick a report to filter by date range, search and export.</p>
      </div>

      <div className="max-w-md">
        <Input className="h-9" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a report..." />
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No reports match &ldquo;{filter}&rdquo;</p>
          <p className="text-sm text-muted-foreground">Try a different term.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.group} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.group}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.reports.map((report) => (
                  <Link
                    key={report.slug}
                    href={`/dashboard/reports/${report.slug}`}
                    className="group flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm transition-colors hover:border-primary/50"
                  >
                    <span className="flex items-center justify-between gap-2 font-medium">
                      {report.label}
                      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </span>
                    <span className="text-sm text-muted-foreground">{report.description}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
