import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/** Minimal RFC4180 CSV parser (handles quoted fields with embedded commas/quotes/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface ProductRow {
  postTitle: string;
  sku: string;
  regularPrice: string;
}

/** Splits a product name into a base food name + size sub-variant, when a trailing size token is present. */
function splitVariant(name: string): { food: string; subVariant: string | null } {
  const trimmed = name.trim();
  // Matches trailing size tokens like "180ML", "1.5LTR", "AADHA KG", "PER KG", "750 ML", "1KG"
  const sizePattern =
    /\s*[-/]?\s*((\d+(\.\d+)?\s*(ML|ml|LTR|ltr|L|l|KG|kg|G|g|GM|gm)\b)|(PER\s*KG)|(AADHA\s*KG)|(HALF\s*KG)|(PER\s*PC|PER\s*PIC|PER\s*PICE))\s*$/i;
  const match = trimmed.match(sizePattern);
  if (match) {
    const food = trimmed.slice(0, match.index).trim().replace(/[-/]\s*$/, '').trim();
    const subVariant = match[0].trim();
    if (food.length > 0) {
      return { food, subVariant };
    }
  }
  return { food: trimmed, subVariant: null };
}

async function main() {
  const csvPath = 'C:\\Users\\user\\Desktop\\product_export_2026-08-22-06-14-30.csv';
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  const header = rows[0];
  const idx = {
    postTitle: header.indexOf('post_title'),
    sku: header.indexOf('sku'),
    regularPrice: header.indexOf('regular_price'),
    postStatus: header.indexOf('post_status'),
  };

  const products: ProductRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const postTitle = (row[idx.postTitle] || '').trim();
    if (!postTitle) continue;
    if (idx.postStatus >= 0 && row[idx.postStatus] && row[idx.postStatus] !== 'publish') continue;
    products.push({
      postTitle,
      sku: (row[idx.sku] || '').trim(),
      regularPrice: (row[idx.regularPrice] || '').trim(),
    });
  }

  // Group into food -> [{ subVariant, sku, price }]
  const groups = new Map<string, { subVariant: string | null; sku: string; price: string; fullName: string }[]>();
  for (const p of products) {
    const { food, subVariant } = splitVariant(p.postTitle);
    const list = groups.get(food) || [];
    list.push({ subVariant, sku: p.sku, price: p.regularPrice, fullName: p.postTitle });
    groups.set(food, list);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Food-Variant-SubVariant');
  sheet.columns = [
    { header: 'Food Name', key: 'food_name', width: 32 },
    { header: 'Variant', key: 'variant_name', width: 18 },
    { header: 'Sub-Variant', key: 'sub_variant_name', width: 20 },
    { header: 'Food Item Name', key: 'food_item_name', width: 36 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Is Default', key: 'is_default', width: 12 },
    { header: 'Is Active', key: 'is_active', width: 12 },
    { header: 'Sort Order', key: 'sort_order', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  let totalRows = 0;
  for (const [food, items] of groups) {
    items.forEach((item, i) => {
      sheet.addRow({
        food_name: food,
        variant_name: '',
        sub_variant_name: item.subVariant || '',
        food_item_name: item.fullName,
        sku: item.sku,
        price: item.price ? Number(item.price) : 0,
        is_default: items.length === 1 || i === 0,
        is_active: true,
        sort_order: i,
      });
      totalRows++;
    });
  }
  sheet.autoFilter = { from: 'A1', to: `I${totalRows + 1}` };

  const outPath = path.resolve(__dirname, '../../food-variant-subvariant-import-template.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Parsed ${products.length} products into ${groups.size} food groups (${totalRows} rows) -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
