import { notFound } from "next/navigation"

import { findReport } from "../report-catalog"
import { ReportView } from "./report-view"

/** One report, at its own URL — so a filtered report can be linked or bookmarked instead of living in page state. */
export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = findReport(slug)
  if (!entry) notFound()

  // key={slug} so switching reports remounts rather than carrying the
  // previous report's search term and page number into the new one.
  return <ReportView key={slug} slug={entry.definition.slug} label={entry.definition.label} description={entry.definition.description} />
}
