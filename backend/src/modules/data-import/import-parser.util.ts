import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

function normaliseHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  // A cell Excel has formatted as a date (even accidentally — a SKU or code
  // like "01-02" auto-detected as a date) comes back as a native Date, not a
  // { text } / { result } rich-value object. Falling through to
  // String(value) below would print either a full locale timestamp for a
  // valid date, or the literal string "Invalid Date" for a malformed one —
  // both leak into the parsed row as data. Render as plain YYYY-MM-DD, and
  // an unparsable date as empty (same as a blank cell) rather than a string
  // that reads as real data.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object' && 'text' in (value as unknown as Record<string, unknown>)) {
    return String((value as unknown as { text: unknown }).text ?? '');
  }
  if (typeof value === 'object' && 'result' in (value as unknown as Record<string, unknown>)) {
    return String((value as unknown as { result: unknown }).result ?? '');
  }
  return String(value).trim();
}

export interface ParseImportFileOptions {
  /** Drops rows that shouldn't be imported at all (e.g. trashed source rows), before they're returned. */
  rowFilter?: (raw: Record<string, string>) => boolean;
}

/**
 * Parses an uploaded CSV/Excel buffer into raw row objects keyed by logical
 * column name (per `headerAliases`) — no domain validation here, that's each
 * ImportDomainConfig's `validateRows`. Unknown headers are dropped rather
 * than kept, so a stray "notes" column never masquerades as a recognised
 * field. Generalised from foods-import.util.ts's parseFoodsImportFile —
 * behaviour is unchanged, only the header table and row filter are now
 * caller-supplied instead of hard-coded to Foods.
 */
export async function parseImportFile(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
  headerAliases: Record<string, string>,
  opts?: ParseImportFileOptions,
): Promise<Record<string, string>[]> {
  const isCsv =
    mimetype === 'text/csv' ||
    mimetype === 'application/csv' ||
    originalname.toLowerCase().endsWith('.csv');

  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;
  try {
    if (isCsv) {
      sheet = await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const first = workbook.worksheets[0];
      if (!first) {
        throw new BadRequestException('The uploaded file has no worksheet');
      }
      sheet = first;
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Could not parse the uploaded file as CSV or Excel');
  }

  const headerRow = sheet.getRow(1);
  const columnKeys = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = headerAliases[normaliseHeader(cellText(cell))];
    if (key) columnKeys.set(colNumber, key);
  });

  if (columnKeys.size === 0) {
    throw new BadRequestException('No recognised columns found in the uploaded file');
  }

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const isEmpty = row.cellCount === 0 || row.values === undefined;
    if (isEmpty) return;

    const values: Record<string, string> = {};
    let hasAnyValue = false;
    for (const [colNumber, key] of columnKeys) {
      const text = cellText(row.getCell(colNumber));
      if (text !== '') hasAnyValue = true;
      values[key] = text;
    }
    if (!hasAnyValue) return;

    if (opts?.rowFilter && !opts.rowFilter(values)) return;

    rows.push(values);
  });

  return rows;
}
