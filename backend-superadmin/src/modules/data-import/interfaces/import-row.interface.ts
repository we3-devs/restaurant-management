/**
 * Base shape every domain's validated row must extend. `rowNumber` is the
 * stable 1-based position from the originally parsed file (header is row 1,
 * so the first data row is 2) — it's how the server re-associates a
 * `clientRowId` with its row on the first commit attempt (see
 * ImportCommitRowInput), independent of whatever order the frontend sends
 * chunks in. `errors` is empty for a row that passed validation, mirroring
 * the existing ImportFoodRow convention (errors embedded per-row) rather
 * than a separate parallel error list.
 */
export interface ImportValidatedRow {
  rowNumber: number;
  errors: string[];
}

/**
 * One row in a commit request. The server owns the (clientRowId, rowNumber)
 * association from the row's first commit attempt onward — see the
 * "commit row payload shape" rule in the data-import plan.
 */
export interface ImportCommitRowInput<Values> {
  clientRowId: string;
  rowNumber: number;
  values: Values;
}
