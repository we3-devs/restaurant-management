import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Ingredient } from '../entities/ingredient.entity';
import { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';
import { Outlet } from '../../outlets/entities/outlet.entity';
import { Unit } from '../../units/entities/unit.entity';

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
  existingId: number | null;
}

/**
 * Ingredients — identity: outlet + code (upsert). Mutable on re-import: name,
 * category, unit. Outlet, category, and base unit are resolved by exact name
 * match only — never fuzzy-matched or auto-created, since a typo silently
 * creating a duplicate reference row is worse for inventory data than a
 * rejected row. Ingredients are outlet-scoped, so the same code may exist
 * under different outlets — identity/upsert matching is always (outlet,
 * code), never code alone.
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
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<IngredientImportRow[]> {
    const [existingIngredients, categories, units, outlets] = await Promise.all([
      this.ingredientsRepository.find({ select: { id: true, code: true, outletId: true } }),
      this.categoriesRepository.find({ select: { id: true, name: true } }),
      this.unitsRepository.find({ select: { id: true, name: true } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const existingByOutletAndCode = new Map(
      existingIngredients.map((i) => [`${i.outletId}::${i.code.trim().toLowerCase()}`, i.id]),
    );
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unitByName = new Map(units.map((u) => [u.name.trim().toLowerCase(), u.id]));
    const outletByName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
    const seenKeysInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const code = (raw.code ?? '').trim();
      const outletName = (raw.outlet ?? '').trim();
      const categoryName = (raw.category ?? '').trim();
      const unitName = (raw.unit ?? '').trim();
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
      try {
        if (row.existingId) {
          await repo.update(row.existingId, {
            name: row.name,
            ingredientCategoryId: row.categoryId!,
            baseUnitId: row.unitId!,
          });
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
            }),
          );
          succeeded.push({ rowNumber: row.rowNumber, entityId: created.id });
        }
      } catch (error) {
        failures.push({ rowNumber: row.rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { committedCount: succeeded.length, failedCount: failures.length, succeeded, failures };
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');
    sheet.addRow(['outlet', 'name', 'code', 'category', 'unit']);
    sheet.addRow(['Main Outlet', 'Tomato', 'ING-001', 'Vegetables', 'Kilogram']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async buildExport(): Promise<Buffer> {
    const [ingredients, categories, units, outlets] = await Promise.all([
      this.ingredientsRepository.find({ order: { id: 'ASC' } }),
      this.categoriesRepository.find({ select: { id: true, name: true } }),
      this.unitsRepository.find({ select: { id: true, name: true } }),
      this.outletsRepository.find({ select: { id: true, name: true } }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const unitById = new Map(units.map((u) => [u.id, u.name]));
    const outletById = new Map(outlets.map((o) => [o.id, o.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');
    sheet.addRow(['outlet', 'name', 'code', 'category', 'unit']);
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
