import type { EntityManager } from 'typeorm';
import type { ImportValidatedRow } from './import-row.interface';
import type { ImportCommitResult } from './import-result.interface';

/**
 * One raw row handed to `validateRows`, carrying the rowNumber the engine
 * already knows about it — never re-derived from the row's position in
 * whatever array happens to be passed in. That distinction matters because
 * validateRows is called on a full batch at preview time, but on an
 * arbitrary later subset at revalidate/commit time (e.g. just the rows in
 * one chunk) — deriving rowNumber from array index would silently renumber
 * every row in a chunk that doesn't start at the file's first data row.
 */
export interface ImportRawRow<Row> {
  rowNumber: number;
  raw: Row;
}

/**
 * What a domain (outlets, ingredients, employees, ...) plugs into the
 * generic data-import engine. Kept narrow and domain-behavior-only — the
 * engine (data-import.module/.controller/.service) must never know these
 * domain names or their business rules; see the data-import plan's
 * "architectural rule". There is deliberately no `revalidateRows` — the
 * revalidate endpoint and the commit endpoint both just call `validateRows`
 * again on the submitted rows, so validation logic can't diverge between the
 * two paths and the backend never trusts a client's claim that rows were
 * already revalidated.
 *
 * Each implementation's class doc comment must state its identity/mutability
 * contract explicitly, e.g.:
 *   Ingredients — identity: SKU (upsert). Mutable on re-import: name, category, unit, cost.
 *   Employees   — create only. No upsert; re-importing an existing employee is a validation error, not an update.
 * That's what stops an importer from silently turning into a full-entity overwrite later.
 */
export interface ImportDomainConfig<Row = Record<string, string>, ValidatedRow extends ImportValidatedRow = ImportValidatedRow> {
  /** Unique slug, e.g. 'outlets' | 'ingredients' | 'employees' | 'customers' | 'suppliers' | 'foods'. Used as the :domain path param. */
  domain: string;
  label: string;
  mode: 'create' | 'upsert';
  /** Presentation-only description of the upsert identity, e.g. "SKU" or "phone or email" — shown in the UI, never used for actual lookup logic (that stays in validateRows/commitRows). */
  identityDescription?: string;
  /** Normalised-header -> logical column key, same convention as foods-import.util.ts's HEADER_ALIASES. */
  headerAliases: Record<string, string>;
  /** Drops rows that shouldn't become records at all (e.g. trashed source rows) before validation ever sees them. */
  rowFilter?: (raw: Row) => boolean;
  /** Validates/looks-up a batch of raw rows. Called at preview, at revalidate, and again at commit (never trusted from a prior call) — the caller-supplied rowNumber on each row must be preserved on the corresponding output row, never recomputed from array position. */
  validateRows(rows: ImportRawRow<Row>[]): Promise<ValidatedRow[]>;
  /**
   * Called once per chunk, inside a transaction the engine owns. `manager` is
   * that transaction's EntityManager — implementations MUST perform every
   * write through it (no injected repository/default manager), so the engine
   * can guarantee claim -> domain writes -> row status -> job counts commit
   * or roll back together as one unit for the chunk.
   */
  commitRows(rows: ValidatedRow[], manager: EntityManager): Promise<ImportCommitResult>;
  /** Builds a downloadable blank (or header+example-row) template for this domain. */
  buildTemplate(): Promise<Buffer>;
  /** Builds a spreadsheet of every existing record for this domain, using the same columns as buildTemplate. */
  buildExport(): Promise<Buffer>;
}
