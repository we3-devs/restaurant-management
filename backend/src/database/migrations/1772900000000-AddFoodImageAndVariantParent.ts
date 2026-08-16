import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two additions to the menu model:
 *
 * 1. `foods.image_url` — one photo per item. Deliberately on the food, not on
 *    the variant: a Half and a Full momo are the same dish.
 *
 * 2. `food_variants.parent_id` — self-referencing, the same shape
 *    `food_categories.parent_id` already uses. Lets a food carry two levels
 *    (Momo -> Veg/Chicken/Buff -> Half/Full) instead of one flat list.
 *
 *    Price stays on the row, so a leaf carries the real price and a parent is
 *    just a grouping label. That's what allows Chicken Full to cost more than
 *    Veg Full — a shared size modifier could not express it.
 *
 *    ON DELETE CASCADE: removing "Chicken" must take its Half/Full with it,
 *    otherwise the children become unreachable rows that still resolve on
 *    order items.
 *
 * Existing single-level variants keep parent_id NULL and are unaffected.
 */
export class AddFoodImageAndVariantParent1772900000000
  implements MigrationInterface
{
  name = 'AddFoodImageAndVariantParent1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE foods
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024)
    `);

    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS parent_id BIGINT
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_food_variants_parent'
        ) THEN
          ALTER TABLE food_variants
          ADD CONSTRAINT fk_food_variants_parent
          FOREIGN KEY (parent_id) REFERENCES food_variants(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Every read of a variant tree filters on parent_id (children of X, or
    // top-level where NULL), so it needs its own index.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variants_parent_id
      ON food_variants (parent_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_food_variants_parent_id`,
    );
    await queryRunner.query(
      `ALTER TABLE food_variants DROP CONSTRAINT IF EXISTS fk_food_variants_parent`,
    );
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS parent_id`,
    );
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS image_url`);
  }
}
