import type { ReportColumn } from '../report-columns';
import { reportCellToString } from './cell.util';

function escapeCsvCell(value: unknown): string {
  const str = reportCellToString(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key])).join(','),
  );
  return [header, ...lines].join('\r\n');
}
