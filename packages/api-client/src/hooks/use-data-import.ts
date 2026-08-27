import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "../client"
import { toQueryString } from "../types"
import { queryKeys } from "../query-keys"

/** One row as returned by preview/revalidate — shape beyond rowNumber/errors is domain-specific (see each ImportDomainConfig on the backend), so the wizard renders it generically via a per-domain column config. */
export interface ImportRow {
  rowNumber: number
  errors: string[]
  [key: string]: unknown
}

export interface ImportDomainSummary {
  domain: string
  label: string
}

export type ImportJobStatus = "previewed" | "committing" | "completed" | "failed" | "failed_partial"

export interface ImportJob {
  id: number
  domain: string
  status: ImportJobStatus
  originalFilename: string
  storageKey: string | null
  totalRows: number
  successRows: number
  errorRows: number
  errorSummary: Record<string, unknown> | null
  createdByUserId: number
  createdAt: string
  updatedAt: string
}

export interface ImportPreviewResult {
  jobId: number
  rows: ImportRow[]
}

export interface ImportCommitRowInput {
  clientRowId: string
  rowNumber: number
  values: Record<string, string>
}

export interface ImportCommitResult {
  job: ImportJob
  result: {
    committedCount: number
    failedCount: number
    succeeded: { rowNumber: number; entityId: number }[]
    failures: { rowNumber: number; error: string }[]
  }
  stillInvalid: ImportRow[]
}

export function useImportDomains() {
  return useQuery({
    queryKey: queryKeys.dataImport.domains(),
    queryFn: () => apiClient<ImportDomainSummary[]>("/data-import/domains"),
  })
}

export function useImportJobs(params: { domain?: string; status?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.dataImport.jobs(params),
    queryFn: () => apiClient<ImportJob[]>(`/data-import/jobs${toQueryString(params)}`),
  })
}

/**
 * Deliberately does not go through apiClient: that helper forces
 * Content-Type: application/json, whereas FormData needs the browser to set
 * the header itself so the generated multipart boundary is included.
 *
 * Uses XMLHttpRequest rather than fetch specifically so upload progress is
 * observable — fetch has no upload-progress event, only XHR does. Mirrors
 * usePreviewFoodsImport (packages/api-client/src/hooks/use-foods.ts).
 */
export function usePreviewImport(domain: string) {
  return useMutation({
    mutationFn: ({ file, onUploadProgress }: { file: File; onUploadProgress?: (percent: number) => void }) =>
      new Promise<ImportPreviewResult>((resolve, reject) => {
        const form = new FormData()
        form.append("file", file)

        const xhr = new XMLHttpRequest()
        xhr.open("POST", `/api/backend/data-import/${domain}/preview`)
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onUploadProgress) {
            onUploadProgress(Math.round((event.loaded / event.total) * 100))
          }
        }
        xhr.onload = () => {
          let body: unknown = null
          try {
            body = JSON.parse(xhr.responseText)
          } catch {
            // non-JSON error body, fall through to status-based message below
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as ImportPreviewResult)
          } else {
            const message = (body as { message?: string } | null)?.message
            reject(new Error(message ?? `Import preview failed with ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error("Import preview failed — network error"))
        xhr.send(form)
      }),
  })
}

export function useRevalidateImport(domain: string) {
  return useMutation({
    mutationFn: ({ jobId, rows }: { jobId: number; rows: { rowNumber: number; values: Record<string, string> }[] }) =>
      apiClient<ImportPreviewResult>(`/data-import/${domain}/revalidate`, {
        method: "POST",
        body: JSON.stringify({ jobId, rows }),
      }),
  })
}

export function useCommitImport(domain: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, rows }: { jobId: number; rows: ImportCommitRowInput[] }) =>
      apiClient<ImportCommitResult>(`/data-import/${domain}/commit`, {
        method: "POST",
        body: JSON.stringify({ jobId, rows }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataImport.jobs() }),
  })
}

/** Same-origin proxy URL — safe to use directly as an <a href>/download link, since the browser attaches the session cookie automatically and the proxy attaches the bearer token server-side. */
export function importTemplateUrl(domain: string): string {
  return `/api/backend/data-import/${domain}/template`
}

/** Same-origin proxy URL for downloading every existing record for a domain — see importTemplateUrl. */
export function exportDataUrl(domain: string): string {
  return `/api/backend/data-import/${domain}/export`
}
