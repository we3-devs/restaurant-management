import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { parseImportFile } from './import-parser.util';

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  displayname: 'name',
  sku: 'sku',
};

async function buildXlsxBuffer(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function buildCsvBuffer(headers: string[], rows: string[][]): Buffer {
  const lines = [headers, ...rows].map((cells) => cells.join(','));
  return Buffer.from(lines.join('\n'), 'utf-8');
}

describe('parseImportFile', () => {
  it('resolves header aliases and returns rows keyed by logical column name (XLSX)', async () => {
    const buffer = await buildXlsxBuffer(
      ['Display Name', 'SKU'],
      [
        ['Widget', 'SKU-1'],
        ['Gadget', 'SKU-2'],
      ],
    );

    const rows = await parseImportFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'file.xlsx', HEADER_ALIASES);

    expect(rows).toEqual([
      { name: 'Widget', sku: 'SKU-1' },
      { name: 'Gadget', sku: 'SKU-2' },
    ]);
  });

  it('resolves header aliases and returns rows keyed by logical column name (CSV)', async () => {
    const buffer = buildCsvBuffer(
      ['name', 'sku'],
      [['Widget', 'SKU-1']],
    );

    const rows = await parseImportFile(buffer, 'text/csv', 'file.csv', HEADER_ALIASES);

    expect(rows).toEqual([{ name: 'Widget', sku: 'SKU-1' }]);
  });

  it('drops columns with no matching alias', async () => {
    const buffer = buildCsvBuffer(
      ['name', 'notes'],
      [['Widget', 'internal note']],
    );

    const rows = await parseImportFile(buffer, 'text/csv', 'file.csv', HEADER_ALIASES);

    expect(rows).toEqual([{ name: 'Widget' }]);
  });

  it('skips fully empty rows', async () => {
    const buffer = buildCsvBuffer(
      ['name', 'sku'],
      [
        ['Widget', 'SKU-1'],
        ['', ''],
        ['Gadget', 'SKU-2'],
      ],
    );

    const rows = await parseImportFile(buffer, 'text/csv', 'file.csv', HEADER_ALIASES);

    expect(rows).toHaveLength(2);
  });

  it('applies a custom rowFilter', async () => {
    const buffer = buildCsvBuffer(
      ['name', 'sku'],
      [
        ['Keep', 'SKU-1'],
        ['Drop', 'SKU-2'],
      ],
    );

    const rows = await parseImportFile(buffer, 'text/csv', 'file.csv', HEADER_ALIASES, {
      rowFilter: (raw) => raw.name !== 'Drop',
    });

    expect(rows).toEqual([{ name: 'Keep', sku: 'SKU-1' }]);
  });

  it('throws when no header matches a known alias', async () => {
    const buffer = buildCsvBuffer(['unknown_column'], [['value']]);

    await expect(parseImportFile(buffer, 'text/csv', 'file.csv', HEADER_ALIASES)).rejects.toThrow(
      BadRequestException,
    );
  });
});
