import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `ingredients.ingredient_category_id` is becoming mandatory now that
 * category determines an ingredient's type (see
 * AddTypeToIngredientCategories1774500000000) — an ingredient can no longer
 * exist without a category. Any ingredient that currently has no category is
 * backfilled into a new "Uncategorized" category (type 'raw_material',
 * matching the old per-ingredient default), then the column is locked to
 * NOT NULL.
 */
export class BackfillUncategorizedIngredients1774600000000
  implements MigrationInterface
{
  name = 'BackfillUncategorizedIngredients1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO ingredient_categories (name, slug, code, type, is_active, created_at, updated_at)
      SELECT 'Uncategorized', 'uncategorized', NULL, 'raw_material', true, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM ingredient_categories WHERE slug = 'uncategorized'
      )
    `);

    await queryRunner.query(`
      UPDATE ingredients
      SET ingredient_category_id = (
        SELECT id FROM ingredient_categories WHERE slug = 'uncategorized'
      )
      WHERE ingredient_category_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingredients ALTER COLUMN ingredient_category_id SET NOT NULL
    `);
  }

  // Not reversible: which specific ingredient rows were originally
  // uncategorized isn't tracked once backfilled, so down() only relaxes the
  // constraint — it can't restore the original NULLs.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients ALTER COLUMN ingredient_category_id DROP NOT NULL
    `);
  }
}
