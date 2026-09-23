import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Ingredient } from '../entities/ingredient.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { WarehouseIngredientStock } from '../../inventory-stock/entities/warehouse-ingredient-stock.entity';
import { WarehouseIngredientStocksService } from '../../inventory-stock/warehouse-ingredient-stocks.service';
import { IngredientStockIn } from '../../stock-ins/entities/ingredient-stock-in.entity';
import { IngredientStockInItem } from '../../stock-ins/entities/ingredient-stock-in-item.entity';
import { generateDocumentNumber } from '../../../common/utils/document-number.util';
import { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { Unit } from '../../units/entities/unit.entity';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../../common/tenant/tenant-scope';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface IngredientImportRow extends ImportValidatedRow {
  code: string;
  name: string;
  /** Raw lookup text as typed/uploaded — echoed back (not just the resolved id) so the frontend has something editable to redisplay and resend at revalidate/commit time. */
  outlet: string;
  outletId: number | null;
  category: string;
  categoryId: number | null;
  unit: string;
  unitId: number | null;
  /** Optional opening balance. Blank means "reference data only" — the ingredient is created but never lands in a warehouse. */
  warehouse: string;
  warehouseId: number | null;
  openingQuantity: number | null;
  unitCost: number | null;
  existingId: number | null;
}

/** Trimmed cell parsed as a number; null for blank, NaN for unparseable (the caller reports it). */
function parseNumericCell(raw: string | undefined): number | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  return Number(text);
}

/**
 * Ingredients — identity: outlet + code (upsert). Mutable on re-import: name,
 * category, unit. Outlet, category, and base unit are resolved by exact name
 * match only — never fuzzy-matched or auto-created, since a typo silently
 * creating a duplicate reference row is worse for inventory data than a
 * rejected row. Ingredients are outlet-scoped, so the same code may exist
 * under different outlets — identity/upsert matching is always (outlet,
 * code), never code alone.
 *
 * Opening stock: an ingredient row on its own is reference data and never
 * shows up under Manage Inventory Items, which lists warehouse stock rows.
 * Supplying warehouse + openingQuantity posts that balance through the same
 * stock-in document + ledger path the UI uses, which is what materialises
 * the stock row. It is deliberately one-shot — a re-import never re-posts an
 * opening balance for a (warehouse, ingredient) pair that already has stock,
 * so repeatedly uploading the same sheet can't inflate quantities.
 */
@Injectable()
export class IngredientsImporter implements ImportDomainConfig<Record<string, string>, IngredientImportRow> {
  domain = 'ingredients';
  label = 'Ingredients';
  mode = 'upsert' as const;
  identityDescription = 'outlet + code';
  headerAliases: Record<string, string> = {
    outlet: 'outlet',
    name: 'name',
    code: 'code',
    category: 'category',
    ingredientcategory: 'category',
    unit: 'unit',
    baseunit: 'unit',
    minimumstock: 'minimumStock',
    reorderlevel: 'reorderLevel',
    reorderquantity: 'reorderQuantity',
    warehouse: 'warehouse',
    location: 'warehouse',
    openingquantity: 'openingQuantity',
    openingqty: 'openingQuantity',
    quantity: 'openingQuantity',
    unitcost: 'unitCost',
    cost: 'unitCost',
  };

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
    @InjectRepository(IngredientCategory)
    private readonly categoriesRepository: Repository<IngredientCategory>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
    private readonly stocksService: WarehouseIngredientStocksService,
    private readonly tenantContext: TenantContext = new TenantContext(),
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<IngredientImportRow[]> {
    const [existingIngredients, categories, units, outlets, warehouses] = await Promise.all([
      this.ingredientsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, code: true, outletId: true } }),
      this.categoriesRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.unitsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.outletsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.warehousesRepository.find({ select: { id: true, name: true, outletId: true } }),
    ]);
    const existingByOutletAndCode = new Map(
      existingIngredients.map((i) => [`${i.outletId}::${i.code.trim().toLowerCase()}`, i.id]),
    );
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unitByName = new Map(units.map((u) => [u.name.trim().toLowerCase(), u.id]));
    const outletByName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
    // Warehouse names only have to be unique within an outlet, so the row's
    // resolved outlet is part of the key — matching on name alone could pull
    // in another outlet's "Main Store".
    const warehouseByOutletAndName = new Map(
      warehouses.map((w) => [`${w.outletId}::${w.name.trim().toLowerCase()}`, w.id]),
    );
    const seenKeysInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const code = (raw.code ?? '').trim();
      const outletName = (raw.outlet ?? '').trim();
      const categoryName = (raw.category ?? '').trim();
      const unitName = (raw.unit ?? '').trim();
      const warehouseName = (raw.warehouse ?? '').trim();
      const errors: string[] = [];

      if (!name) errors.push('name is required');

      let outletId: number | null = null;
      if (!outletName) {
        errors.push('outlet is required');
      } else {
        outletId = outletByName.get(outletName.toLowerCase()) ?? null;
        if (outletId === null) errors.push(`Outlet "${outletName}" not found — expected an existing outlet`);
      }

      if (!code) {
        errors.push('code is required');
      } else if (outletId !== null) {
        const batchKey = `${outletId}::${code.toLowerCase()}`;
        if (seenKeysInBatch.has(batchKey)) {
          errors.push(`Duplicate ingredient code "${code}" for outlet "${outletName}" in this file`);
        }
        seenKeysInBatch.add(batchKey);
      }

      let categoryId: number | null = null;
      if (!categoryName) {
        errors.push('category is required');
      } else {
        categoryId = categoryByName.get(categoryName.toLowerCase()) ?? null;
        if (categoryId === null) errors.push(`Category "${categoryName}" not found — expected an existing ingredient category`);
      }

      let unitId: number | null = null;
      if (!unitName) {
        errors.push('unit is required');
      } else {
        unitId = unitByName.get(unitName.toLowerCase()) ?? null;
        if (unitId === null) errors.push(`Unit "${unitName}" not found — expected an existing unit`);
      }

      // Opening stock is all-or-nothing: a warehouse with no quantity (or
      // the reverse) is a half-filled row, which is far more likely a
      // mistake than an intent to post nothing.
      let warehouseId: number | null = null;
      let openingQuantity = parseNumericCell(raw.openingQuantity);
      let unitCost = parseNumericCell(raw.unitCost);

      if (openingQuantity !== null && !Number.isFinite(openingQuantity)) {
        errors.push(`openingQuantity "${(raw.openingQuantity ?? '').trim()}" is not a number`);
        openingQuantity = null;
      } else if (openingQuantity !== null && openingQuantity <= 0) {
        errors.push('openingQuantity must be greater than 0');
        openingQuantity = null;
      }

      if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        errors.push(`unitCost "${(raw.unitCost ?? '').trim()}" is not a non-negative number`);
        unitCost = null;
      }

      if (warehouseName && openingQuantity === null) {
        if (!errors.some((e) => e.startsWith('openingQuantity'))) {
          errors.push('openingQuantity is required when warehouse is given');
        }
      } else if (!warehouseName && openingQuantity !== null) {
        errors.push('warehouse is required when openingQuantity is given');
      } else if (warehouseName && outletId !== null) {
        warehouseId = warehouseByOutletAndName.get(`${outletId}::${warehouseName.toLowerCase()}`) ?? null;
        if (warehouseId === null) {
          errors.push(`Warehouse "${warehouseName}" not found under outlet "${outletName}"`);
        }
      }

      const existingId =
        code && outletId !== null
          ? (existingByOutletAndCode.get(`${outletId}::${code.toLowerCase()}`) ?? null)
          : null;

      return {
        rowNumber,
        code,
        name,
        outlet: outletName,
        outletId,
        category: categoryName,
        categoryId,
        unit: unitName,
        unitId,
        warehouse: warehouseName,
        warehouseId,
        openingQuantity,
        unitCost,
        existingId,
        errors,
      };
    });
  }

  async commitRows(rows: IngredientImportRow[], manager: EntityManager): Promise<ImportCommitResult> {
    const repo = manager.getRepository(Ingredient);
    const failures: ImportCommitResult['failures'] = [];
    const succeeded: ImportCommitResult['succeeded'] = [];

    for (const row of rows) {
      // Each row gets its own SAVEPOINT — without this, one row's constraint
      // violation aborts the whole shared chunk transaction, and every row
      // after it fails with a useless "current transaction is aborted"
      // instead of its own real error.
      const savepoint = `import_row_${row.rowNumber}`;
      await manager.query(`SAVEPOINT "${savepoint}"`);
      try {
        if (row.existingId) {
          await repo.update(scopedWhere(this.tenantContext, { id: row.existingId }), {
            name: row.name,
            ingredientCategoryId: row.categoryId!,
            baseUnitId: row.unitId!,
          });
          await this.postOpeningStock(row, row.existingId, manager);
          await manager.query(`RELEASE SAVEPOINT "${savepoint}"`);
          succeeded.push({ rowNumber: row.rowNumber, entityId: row.existingId });
        } else {
          const created = await repo.save(
            repo.create({
              name: row.name,
              code: row.code,
              slug: slugify(row.name),
              outletId: row.outletId!,
              ingredientCategoryId: row.categoryId!,
              baseUnitId: row.unitId!,
              ...tenantFields(this.tenantContext),
            }),
          );
          await this.postOpeningStock(row, created.id, manager);
          await manager.query(`RELEASE SAVEPOINT "${savepoint}"`);
          succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
        }
      } catch (error) {
        await manager.query(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  /**
   * Materialises the ingredient as an inventory item by posting its opening
   * balance, using the same stock-in document + ledger path the Manage
   * Inventory Items dialog uses — the stock table is derived, so writing a
   * row into it directly would leave the ledger disagreeing with it.
   *
   * No-ops when the row carried no opening balance, and — importantly —
   * when the pair already has a stock row, so re-importing the same sheet
   * updates the ingredient without ever re-posting stock. Runs on the
   * engine's transaction manager, inside the caller's per-row SAVEPOINT.
   */
  private async postOpeningStock(
    row: IngredientImportRow,
    ingredientId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (row.warehouseId === null || row.openingQuantity === null) return;

    const alreadyStocked = await manager.getRepository(WarehouseIngredientStock).findOne({
      where: { warehouseId: row.warehouseId, ingredientId },
      select: { warehouseId: true, ingredientId: true },
    });
    if (alreadyStocked) return;

    const unitCost = row.unitCost ?? 0;
    const stockIn = await manager.getRepository(IngredientStockIn).save(
      manager.getRepository(IngredientStockIn).create({
        stockInNo: generateDocumentNumber('STIN', row.warehouseId),
        warehouseId: row.warehouseId,
        stockInDate: new Date().toISOString().slice(0, 10),
        source: 'correction',
        status: 'approved',
        remarks: `Opening stock from ingredient import (row ${row.rowNumber})`,
        // The import engine commits chunks without a user context, so the
        // document is unattributed rather than wrongly attributed.
        createdBy: null,
        approvedBy: null,
        approvedAt: new Date(),
      }),
    );

    await manager.getRepository(IngredientStockInItem).save(
      manager.getRepository(IngredientStockInItem).create({
        ingredientStockInId: stockIn.id,
        ingredientId,
        ingredientBatchId: null,
        quantity: row.openingQuantity,
        unitCost,
        totalCost: Math.round(row.openingQuantity * unitCost * 100) / 100,
      }),
    );

    await this.stocksService.applyMovement({
      warehouseId: row.warehouseId,
      ingredientId,
      quantityDelta: row.openingQuantity,
      unitCost,
      transactionType: 'opening_stock',
      referenceType: 'stock_in',
      referenceId: stockIn.id,
      createdBy: null,
      manager,
    });
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');
    sheet.addRow(['outlet', 'name', 'code', 'category', 'unit', 'warehouse', 'openingQuantity', 'unitCost']);
    sheet.addRow(['Main Outlet', 'Tomato', 'ING-001', 'Vegetables', 'Kilogram', 'Main Store', 25, 1.5]);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [ingredients, categories, units, outlets] = await Promise.all([
      this.ingredientsRepository.find({ where: scopedWhere(this.tenantContext, {}), order: { id: 'ASC' } }),
      this.categoriesRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.unitsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
      this.outletsRepository.find({ where: scopedWhere(this.tenantContext, {}), select: { id: true, name: true } }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const unitById = new Map(units.map((u) => [u.id, u.name]));
    const outletById = new Map(outlets.map((o) => [o.id, o.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');
    // Same header as the template so an export can be edited and re-imported.
    // The opening-stock columns are left blank on purpose: they're a one-off
    // posting instruction, not ingredient state, and an ingredient can hold
    // stock in several warehouses at once — no single value belongs here.
    sheet.addRow(['outlet', 'name', 'code', 'category', 'unit', 'warehouse', 'openingQuantity', 'unitCost']);
    for (const ingredient of ingredients) {
      sheet.addRow([
        outletById.get(ingredient.outletId) ?? '',
        ingredient.name,
        ingredient.code,
        categoryById.get(ingredient.ingredientCategoryId) ?? '',
        unitById.get(ingredient.baseUnitId) ?? '',
      ]);
    }
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
