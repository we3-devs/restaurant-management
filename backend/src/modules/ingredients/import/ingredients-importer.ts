import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { EntityManager, Repository } from 'typeorm';
import type { ImportDomainConfig, ImportRawRow } from '../../data-import/interfaces/import-domain-config.interface';
import type { ImportCommitResult } from '../../data-import/interfaces/import-result.interface';
import type { ImportValidatedRow } from '../../data-import/interfaces/import-row.interface';
import { Ingredient } from '../entities/ingredient.entity';
import { IngredientCategory } from '../../ingredient-categories/entities/ingredient-category.entity';
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
  category: string;
  categoryId: number | null;
  unit: string;
  unitId: number | null;
  existingId: number | null;
}

/**
 * Ingredients — identity: code (upsert). Mutable on re-import: name,
 * category, unit. Category and base unit are resolved by exact name match
 * only — never fuzzy-matched or auto-created, since a typo silently creating
 * a duplicate reference row is worse for inventory data than a rejected row.
 */
@Injectable()
export class IngredientsImporter implements ImportDomainConfig<Record<string, string>, IngredientImportRow> {
  domain = 'ingredients';
  label = 'Ingredients';
  mode = 'upsert' as const;
  identityDescription = 'code';
  headerAliases: Record<string, string> = {
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
  ) {}

  async validateRows(rows: ImportRawRow<Record<string, string>>[]): Promise<IngredientImportRow[]> {
    const [existingIngredients, categories, units] = await Promise.all([
      this.ingredientsRepository.find({ select: { id: true, code: true } }),
      this.categoriesRepository.find({ select: { id: true, name: true } }),
      this.unitsRepository.find({ select: { id: true, name: true } }),
    ]);
    const existingByCode = new Map(existingIngredients.map((i) => [i.code.trim().toLowerCase(), i.id]));
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unitByName = new Map(units.map((u) => [u.name.trim().toLowerCase(), u.id]));
    const seenCodesInBatch = new Set<string>();

    return rows.map(({ rowNumber, raw }) => {
      const name = (raw.name ?? '').trim();
      const code = (raw.code ?? '').trim();
      const categoryName = (raw.category ?? '').trim();
      const unitName = (raw.unit ?? '').trim();
      const errors: string[] = [];

      if (!name) errors.push('name is required');
      if (!code) {
        errors.push('code is required');
      } else {
        const codeKey = code.toLowerCase();
        if (seenCodesInBatch.has(codeKey)) {
          errors.push(`Duplicate ingredient code "${code}" in this file`);
        }
        seenCodesInBatch.add(codeKey);
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

      const existingId = code ? (existingByCode.get(code.toLowerCase()) ?? null) : null;

      return { rowNumber, code, name, category: categoryName, categoryId, unit: unitName, unitId, existingId, errors };
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
    sheet.addRow(['name', 'code', 'category', 'unit']);
    sheet.addRow(['Tomato', 'ING-001', 'Vegetables', 'Kilogram']);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
