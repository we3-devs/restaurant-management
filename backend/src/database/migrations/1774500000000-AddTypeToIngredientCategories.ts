import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `type` is moving from a per-ingredient attribute to a per-category one —
 * every ingredient in a category now shares that category's type (see
 * ingredient-category-type.util.ts). Backfills each existing category's type
 * from its lowest-id ingredient's current `ingredients.type` (verified
 * beforehand: no category in the live DB mixes more than one distinct type
 * across its ingredients, so this is a lossless, deterministic backfill for
 * this dataset). Categories with no ingredients yet default to
 * 'raw_material', matching the old per-ingredient default.
 */
export class AddTypeToIngredientCategories1774500000000
  implements MigrationInterface
{
  name = 'AddTypeToIngredientCategories1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredient_categories ADD COLUMN IF NOT EXISTS type varchar(20)
    `);

    await queryRunner.query(`
      UPDATE ingredient_categories ic
      SET type = sub.type
      FROM (
        SELECT DISTINCT ON (ingredient_category_id) ingredient_category_id, type
        FROM ingredients
        WHERE ingredient_category_id IS NOT NULL
        ORDER BY ingredient_category_id, id ASC
      ) sub
      WHERE ic.id = sub.ingredient_category_id
    `);

    await queryRunner.query(`
      UPDATE ingredient_categories SET type = 'raw_material' WHERE type IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingredient_categories ALTER COLUMN type SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingredient_categories DROP CONSTRAINT IF EXISTS ingredient_categories_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE ingredient_categories ADD CONSTRAINT ingredient_categories_type_check
      CHECK (type IN ('raw_material', 'ready_product', 'packaging', 'consumable', 'beverage'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredient_categories DROP CONSTRAINT IF EXISTS ingredient_categories_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE ingredient_categories DROP COLUMN IF EXISTS type
    `);
  }
}
