import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reusable variant options with per-combination pricing.
 *
 * The parent_id tree that shipped earlier forces a size to be re-entered under
 * every type — the live data shows exactly that, with "Full Plate" under
 * Chicken and a separate "Full" under Veg. This replaces it with two ideas:
 *
 *   - `food_variant_groups` — a named list per food ("Type", "Size").
 *   - `food_variants.kind`  — 'option' rows are labels inside a group and are
 *                             never ordered; 'product' rows are the priced,
 *                             sellable combinations.
 *   - `food_variant_selections` — which options make up a product.
 *
 * Products stay rows in `food_variants`, which is the important part:
 * order_items.food_variant_id keeps pointing at them, so the 14 existing order
 * lines (and every historical one) stay intact with no order-schema change.
 *
 * Migration of existing data is conservative:
 *   - Every variant defaults to kind='product', so a food with a plain flat
 *     list keeps behaving exactly as before.
 *   - A variant that has children is a grouping label already, so it becomes
 *     kind='option' inside an auto-created "Type" group, and each of its
 *     children gains a selection pointing at it. Prices, SKUs and order
 *     references are untouched.
 *   - The size dimension is NOT invented here: "Full Plate" and "Full" are
 *     different strings and guessing that they mean one shared option would
 *     silently merge menu items. Those are added in the UI, once, by hand.
 *
 * parent_id is retained (nullable, unused by new code) rather than dropped, so
 * this migration stays reversible and the old rows remain inspectable.
 */
export class AddVariantGroupsAndSelections1773100000000
  implements MigrationInterface
{
  name = 'AddVariantGroupsAndSelections1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS food_variant_groups (
        id BIGSERIAL PRIMARY KEY,
        food_id BIGINT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sku_segment VARCHAR(32),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variant_groups_food_id
      ON food_variant_groups (food_id)
    `);
    // One "Size" per food, not two.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_food_variant_groups_food_name
      ON food_variant_groups (food_id, name)
    `);

    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS group_id BIGINT
        REFERENCES food_variant_groups(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'product'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variants_group_id
      ON food_variants (group_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS food_variant_selections (
        product_variant_id BIGINT NOT NULL
          REFERENCES food_variants(id) ON DELETE CASCADE,
        option_variant_id BIGINT NOT NULL
          REFERENCES food_variants(id) ON DELETE CASCADE,
        PRIMARY KEY (product_variant_id, option_variant_id)
      )
    `);
    // Resolving "which product has exactly these options" reads by option.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variant_selections_option
      ON food_variant_selections (option_variant_id)
    `);

    // --- convert the existing parent_id tree -------------------------------

    // Parents become options in a per-food "Type" group.
    await queryRunner.query(`
      INSERT INTO food_variant_groups (food_id, name, sort_order)
      SELECT DISTINCT v.food_id, 'Type', 0
        FROM food_variants v
       WHERE v.parent_id IS NULL
         AND EXISTS (SELECT 1 FROM food_variants c WHERE c.parent_id = v.id)
      ON CONFLICT (food_id, name) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE food_variants v
         SET kind = 'option',
             group_id = g.id
        FROM food_variant_groups g
       WHERE g.food_id = v.food_id
         AND g.name = 'Type'
         AND v.parent_id IS NULL
         AND EXISTS (SELECT 1 FROM food_variants c WHERE c.parent_id = v.id)
    `);

    // Each former child keeps its price and SKU as a product, and records the
    // type it belonged to.
    await queryRunner.query(`
      INSERT INTO food_variant_selections (product_variant_id, option_variant_id)
      SELECT v.id, v.parent_id
        FROM food_variants v
       WHERE v.parent_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS food_variant_selections`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_food_variants_group_id`);
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS kind`,
    );
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS group_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS food_variant_groups`);
  }
}
