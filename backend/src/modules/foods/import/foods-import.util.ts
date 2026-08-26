import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

/**
 * Header aliases -> the logical column key used by FoodsImportService.
 * Covers both a plain "name,slug,sku,basePrice,..." sheet and a WordPress/
 * WooCommerce post export ("post_title", "post_name", "regular_price",
 * "tax:product_cat", ...), since that's what most migrations bring in.
 * postStatus/postParent aren't Food fields — they're read by the parser
 * itself to drop trashed posts and product-variation child rows.
 */
const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  posttitle: 'name',
  slug: 'slug',
  postname: 'slug',
  sku: 'sku',
  shortdescription: 'shortDescription',
  description: 'shortDescription',
  postexcerpt: 'shortDescription',
  category: 'foodCategory',
  foodcategory: 'foodCategory',
  categories: 'foodCategory',
  taxproductcat: 'foodCategory',
  itemtype: 'itemType',
  departmenttype: 'departmentType',
  department: 'departmentType',
  foodtype: 'foodType',
  price: 'basePrice',
  baseprice: 'basePrice',
  regularprice: 'basePrice',
  images: 'imageUrl',
  image: 'imageUrl',
  poststatus: 'postStatus',
  postparent: 'postParent',
};

function normaliseHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function firstImageUrl(raw: string): string {
  return raw.split(/[|,\s]+/)[0] ?? '';
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in (value as unknown as Record<string, unknown>)) {
    return String((value as unknown as { text: unknown }).text ?? '');
  }
  if (typeof value === 'object' && 'result' in (value as unknown as Record<string, unknown>)) {
    return String((value as unknown as { result: unknown }).result ?? '');
  }
  return String(value).trim();
}

/**
 * Parses an uploaded CSV/Excel buffer into raw row objects keyed by logical
 * column name (see HEADER_ALIASES) — no validation here, that's
 * FoodsImportService's job. Unknown headers are dropped rather than kept, so
 * a stray "notes" column never masquerades as a recognised field.
 */
export async function parseFoodsImportFile(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
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
    const key = HEADER_ALIASES[normaliseHeader(cellText(cell))];
    if (key) columnKeys.set(colNumber, key);
  });

  if (columnKeys.size === 0) {
    throw new BadRequestException(
      'No recognised columns found — expected at least "name" and "basePrice"',
    );
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
      values[key] = key === 'imageUrl' ? firstImageUrl(text) : text;
    }
    if (!hasAnyValue) return;

    // Trashed WP posts and WooCommerce variation rows (child of a variable
    // product) aren't standalone menu items — skip them rather than importing
    // deleted or duplicate-per-variant rows as separate foods.
    if (values.postStatus?.trim().toLowerCase() === 'trash') return;
    const postParent = values.postParent?.trim();
    if (postParent && postParent !== '0') return;

    rows.push(values);
  });

  return rows;
}
