/** Outcome of committing one chunk of already-claimed, already-revalidated rows. */
export interface ImportCommitResult {
  committedCount: number;
  failedCount: number;
  /** Per-row success, so the engine can record each row's created/updated entityId on its import_job_rows tracking entry. */
  succeeded: { rowNumber: number; entityId: number }[];
  failures: { rowNumber: number; error: string }[];
}
