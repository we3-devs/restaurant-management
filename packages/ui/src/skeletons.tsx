"use client"

import { useEffect, useState } from "react"
import { SearchXIcon } from "lucide-react"

import { Card, CardContent } from "./card"
import { cn } from "./cn"
import { Skeleton } from "./skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

/**
 * Composite, content-shaped loading placeholders built from the same
 * primitives the loaded UI uses (real Table/Card markup), so the skeleton
 * matches the shape — and often the exact layout — of what's arriving.
 *
 * Every component wraps its output in a single live region so a screen
 * reader announces the placeholder once instead of once per child bar.
 */

function SkeletonRegion({
  label = "Loading…",
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  )
}

const DEFAULT_TABLE_WIDTHS = ["w-32", "w-24", "w-20", "w-28"]

export function TableSkeleton({
  rows = 10,
  columns,
  widths = DEFAULT_TABLE_WIDTHS,
  showHeader = true,
  className,
}: {
  rows?: number
  columns: number
  widths?: string[]
  showHeader?: boolean
  className?: string
}) {
  return (
    <SkeletonRegion>
      <Table className={className}>
        {showHeader && (
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-3.5 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <TableCell key={c}>
                  <Skeleton className={cn("h-4", widths[c % widths.length])} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SkeletonRegion>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3.5 w-32" />
      </CardContent>
    </Card>
  )
}

export function StatGridSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <SkeletonRegion>
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonRegion>
  )
}

function FormFields({ fields, showActions }: { fields: number; showActions: boolean }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {showActions && (
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  )
}

export function FormSkeleton({
  fields = 5,
  showActions = true,
  className,
}: {
  fields?: number
  showActions?: boolean
  className?: string
}) {
  return (
    <SkeletonRegion>
      <FormFields fields={fields} showActions={showActions} />
    </SkeletonRegion>
  )
}

export function DetailPageSkeleton({
  fields = 5,
  sections = 1,
  className,
}: {
  fields?: number
  sections?: number
  className?: string
}) {
  return (
    <SkeletonRegion>
      <div className={cn("space-y-6", className)}>
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: sections }).map((_, s) => (
          <Card key={s}>
            <CardContent className="pt-6">
              <FormFields fields={fields} showActions={false} />
            </CardContent>
          </Card>
        ))}
      </div>
    </SkeletonRegion>
  )
}

export function CardGridSkeleton({
  count = 8,
  columns,
  itemClassName,
  className,
}: {
  count?: number
  /** Fixed column count via inline grid-template-columns (e.g. matching a virtualizer). Omit when className carries responsive grid-cols-* classes. */
  columns?: number
  itemClassName?: string
  className?: string
}) {
  return (
    <SkeletonRegion>
      <div
        className={cn("grid gap-3", className)}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className={cn("flex h-full flex-col overflow-hidden p-0", itemClassName)}>
            <Skeleton className="h-24 w-full rounded-none border-0" />
            <CardContent className="flex flex-1 flex-col gap-2 pt-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="mt-auto flex items-center justify-between pt-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </SkeletonRegion>
  )
}

export function ListSkeleton({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <SkeletonRegion>
      <ul className={cn("space-y-2", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

export function TextSkeleton({
  lines = 3,
  lastLineWidth = "w-2/3",
  className,
}: {
  lines?: number
  lastLineWidth?: string
  className?: string
}) {
  return (
    <SkeletonRegion>
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4 w-full", i === lines - 1 && lastLineWidth)} />
        ))}
      </div>
    </SkeletonRegion>
  )
}

/** Centered not-found card, mirroring access-denied.tsx's layout. */
export function NotFoundCard({ resource }: { resource: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <SearchXIcon className="size-10 text-muted-foreground" />
      <p className="font-medium">{resource} not found</p>
      <p className="text-sm text-muted-foreground">
        It may have been deleted, or you may not have access to it.
      </p>
    </div>
  )
}

/**
 * Anti-flicker gate for route-level loading.tsx fallbacks: renders nothing
 * for the first 200ms so a fast cached navigation never flashes a skeleton,
 * then shows the placeholder for real loads. Pair with RouteProgress for the
 * sub-200ms window.
 */
export function LoadingFallback({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null
  return <>{children}</>
}
