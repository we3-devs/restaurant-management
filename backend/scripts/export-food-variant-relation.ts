import { DataSource } from 'typeorm';
import ExcelJS from 'exceljs';
import * as path from 'path';
import 'dotenv/config';

/**
 * Dumps the food -> variant -> sub-variant relation as one flat table:
 * one row per food_variants record (a "food item"), with the parent
 * food name, the global variant/sub-variant names, price, and SKU.
 */
async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  await dataSource.initialize();

  const rows = await dataSource.query(`
    SELECT
      f.id           AS food_id,
      f.name         AS food_name,
      fv.id          AS food_variant_id,
      v.name         AS variant_name,
      sv.name        AS sub_variant_name,
      fv.name        AS food_item_name,
      fv.sku         AS sku,
      fv.price       AS price,
      fv.is_default  AS is_default,
      fv.is_active   AS is_active,
      fv.sort_order  AS sort_order
    FROM food_variants fv
    JOIN foods f ON f.id = fv.food_id
    LEFT JOIN variants v ON v.id = fv.variant_id
    LEFT JOIN sub_variants sv ON sv.id = fv.sub_variant_id
    ORDER BY f.name, v.sort_order NULLS FIRST, sv.sort_order NULLS FIRST
  `);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Food-Variant-SubVariant');

  sheet.columns = [
    { header: 'Food ID', key: 'food_id', width: 10 },
    { header: 'Food Name', key: 'food_name', width: 30 },
    { header: 'Food Item ID', key: 'food_variant_id', width: 12 },
    { header: 'Variant', key: 'variant_name', width: 18 },
    { header: 'Sub-Variant', key: 'sub_variant_name', width: 18 },
    { header: 'Food Item Name', key: 'food_item_name', width: 30 },
    { header: 'SKU', key: 'sku', width: 20 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Is Default', key: 'is_default', width: 12 },
    { header: 'Is Active', key: 'is_active', width: 12 },
    { header: 'Sort Order', key: 'sort_order', width: 12 },
  ];

  sheet.getRow(1).font = { bold: true };
  rows.forEach((r: any) => sheet.addRow(r));
  sheet.autoFilter = { from: 'A1', to: 'K1' };

  const outPath = path.resolve(__dirname, '../../food-variant-subvariant.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Wrote ${rows.length} rows to ${outPath}`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
