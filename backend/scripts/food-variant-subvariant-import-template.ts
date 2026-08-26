import ExcelJS from 'exceljs';
import * as path from 'path';

/**
 * Blank import template matching the food_variants schema (food + variant +
 * sub-variant + price is the only place a sell price lives; variants/sub_variants
 * themselves are global lookups with no price).
 */
async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Food-Variant-SubVariant');

  sheet.columns = [
    { header: 'Food Name', key: 'food_name', width: 30 },
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
  sheet.autoFilter = { from: 'A1', to: 'I1' };

  sheet.addRow({
    food_name: 'Chowmein',
    variant_name: 'Chicken',
    sub_variant_name: 'Full',
    food_item_name: 'Chowmein - Chicken - Full',
    sku: 'CHOWMIN-CHI-FULL',
    price: 250,
    is_default: true,
    is_active: true,
    sort_order: 0,
  });
  sheet.addRow({
    food_name: 'Chowmein',
    variant_name: 'Chicken',
    sub_variant_name: 'Half',
    food_item_name: 'Chowmein - Chicken - Half',
    sku: 'CHOWMIN-CHI-HALF',
    price: 150,
    is_default: false,
    is_active: true,
    sort_order: 1,
  });
  sheet.addRow({
    food_name: 'Chowmein',
    variant_name: 'Veg',
    sub_variant_name: 'Full',
    food_item_name: 'Chowmein - Veg - Full',
    sku: 'CHOWMIN-VEG-FULL',
    price: 200,
    is_default: false,
    is_active: true,
    sort_order: 2,
  });

  const notes = workbook.addWorksheet('Notes');
  notes.columns = [
    { header: 'Column', key: 'col', width: 20 },
    { header: 'Meaning', key: 'meaning', width: 80 },
  ];
  notes.getRow(1).font = { bold: true };
  notes.addRows([
    { col: 'Food Name', meaning: 'Must match an existing food (foods.name), or the food to create first. This row is one variant/sub-variant of it.' },
    { col: 'Variant', meaning: 'Global variant name (variants.name), e.g. Chicken, Veg. Leave blank for a plain item with no variant.' },
    { col: 'Sub-Variant', meaning: 'Global sub-variant name (sub_variants.name), e.g. Full, Half. Leave blank if not sized.' },
    { col: 'Food Item Name', meaning: 'Display name for this specific food+variant+sub-variant combo (food_variants.name).' },
    { col: 'SKU', meaning: 'Unique SKU for this combo (food_variants.sku), e.g. CHOWMIN-CHI-FULL. Optional but must be unique if set.' },
    { col: 'Price', meaning: 'Sell price for this specific combo (food_variants.price). This is the only place price lives — variants/sub-variants carry no price themselves.' },
    { col: 'Is Default', meaning: 'TRUE/FALSE — whether this combo is the default selection for the food.' },
    { col: 'Is Active', meaning: 'TRUE/FALSE — whether this combo is currently sellable.' },
    { col: 'Sort Order', meaning: 'Integer controlling display order among a food\'s combos.' },
  ]);

  const outPath = path.resolve(__dirname, '../../food-variant-subvariant-import-template.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Wrote template to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
