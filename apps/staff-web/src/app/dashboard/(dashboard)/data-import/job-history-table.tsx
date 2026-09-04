"use client"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/skeletons"
import { useDelayedLoading } from "@/components/ui/use-delayed-loading"
import { useImportJobs, type ImportJobStatus } from "@/hooks/use-data-import"

const STATUS_LABEL: Record<ImportJobStatus, string> = {
  previewed: "Previewed",
  committing: "In progress",
  completed: "Completed",
  failed: "Failed",
  failed_partial: "Partially failed",
}

const STATUS_VARIANT: Record<ImportJobStatus, "secondary" | "outline" | "destructive"> = {
  previewed: "outline",
  committing: "outline",
  completed: "secondary",
  failed: "destructive",
  // Distinct from a hard failure — a messy legacy spreadsheet with some bad
  // rows is the expected outcome, not an error state.
  failed_partial: "outline",
}

export function JobHistoryTable({ domain }: { domain?: string }) {
  const { data: jobs, isLoading } = useImportJobs({ domain })
  const showSkeleton = useDelayedLoading(isLoading)

  if (showSkeleton) return <TableSkeleton rows={4} columns={6} />

  if (!jobs || jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">No imports yet for this domain.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Rows</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="max-w-56 truncate">{job.originalFilename}</TableCell>
            <TableCell className="capitalize">{job.domain}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
            </TableCell>
            <TableCell className="tabular-nums text-sm text-muted-foreground">
              {job.successRows}/{job.totalRows} committed
              {job.errorRows > 0 && <span className="text-destructive"> · {job.errorRows} failed</span>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(job.createdAt).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
