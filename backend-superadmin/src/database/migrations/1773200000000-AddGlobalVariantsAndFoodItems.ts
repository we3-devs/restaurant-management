import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Global variant / sub-variant master lists, with food_variants acting as the
 * food-item (the priced combination).
 *
 *   variants      chicken, veg           <- typed once, used by every food
 *   sub_variants  full, half             <- typed once, used by every food
 *   food_variants (food_id, variant_id, sub_variant_id) + price/sku
 *                                        = chowmin + chicken + full @ 250
 *
 * This supersedes the per-food `food_variant_groups` / `food_variant_selections`
 * pair added earlier the same day, which scoped options to a single food and so
 * forced "chicken" to be re-entered for chowmin and again for momo.
 *
 * food_variants remains the sellable row, which is the load-bearing detail:
 * order_items.food_variant_id keeps resolving, so historical orders are
 * untouched and no order-schema change is needed.
 *
 * Existing option names are carried across verbatim — "Chicken MoMo" becomes a
 * global variant called "Chicken MoMo", not "Chicken". Trimming that to a clean
 * shared name is a one-field rename in the UI; guessing it here could silently
 * merge two different menu concepts.
 */
export class AddGlobalVariantsAndFoodItems1773200000000
  implements MigrationInterface
{
  name = 'AddGlobalVariantsAndFoodItems1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['variants', 'sub_variants']) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          sku_segment VARCHAR(32),
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      // One "full" in the whole system — that is the entire point of the list.
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_${table}_name ON ${table} (lower(name))
      `);
    }

    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES variants(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS sub_variant_id BIGINT REFERENCES sub_variants(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variants_variant_id ON food_variants (variant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_variants_sub_variant_id ON food_variants (sub_variant_id)
    `);

    // --- carry over what the per-food group model held --------------------

    // Group sort_order decides the dimension: the first group created by the
    // previous migration is the type dimension, anything later is the size one.
    await queryRunner.query(`
      INSERT INTO variants (name, sku_segment, sort_order)
      SELECT DISTINCT ON (lower(v.name)) v.name, v.sku_segment, v.sort_order
        FROM food_variants v
        JOIN food_variant_groups g ON g.id = v.group_id
       WHERE v.kind = 'option' AND g.sort_order = 0
       ORDER BY lower(v.name), v.id
      ON CONFLICT (lower(name)) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO sub_variants (name, sku_segment, sort_order)
      SELECT DISTINCT ON (lower(v.name)) v.name, v.sku_segment, v.sort_order
        FROM food_variants v
        JOIN food_variant_groups g ON g.id = v.group_id
       WHERE v.kind = 'option' AND g.sort_order > 0
       ORDER BY lower(v.name), v.id
      ON CONFLICT (lower(name)) DO NOTHING
    `);

    // Point each priced row at the global rows matching the options it selected.
    await queryRunner.query(`
      UPDATE food_variants p
         SET variant_id = gv.id
        FROM food_variant_selections s
        JOIN food_variants o ON o.id = s.option_variant_id
        JOIN food_variant_groups g ON g.id = o.group_id AND g.sort_order = 0
        JOIN variants gv ON lower(gv.name) = lower(o.name)
       WHERE s.product_variant_id = p.id
    `);
    await queryRunner.query(`
      UPDATE food_variants p
         SET sub_variant_id = gsv.id
        FROM food_variant_selections s
        JOIN food_variants o ON o.id = s.option_variant_id
        JOIN food_variant_groups g ON g.id = o.group_id AND g.sort_order > 0
        JOIN sub_variants gsv ON lower(gsv.name) = lower(o.name)
       WHERE s.product_variant_id = p.id
    `);

    // parent_id is dropped BEFORE anything is removed, and that ordering is
    // load-bearing: it is a self-referencing FK with ON DELETE CASCADE, so
    // deleting a former parent row would cascade into the priced rows that used
    // to hang off it, which in turn SET NULL on their order_items — mutating
    // historical, completed orders. The relationship it encoded now lives in
    // variant_id / sub_variant_id.
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS parent_id`,
    );

    // The old per-food option rows are redundant now that their meaning lives
    // in the global lists. Soft-deleted rather than deleted: they may be
    // referenced by order history, and a soft delete removes them from menus
    // and from the uniqueness index without touching any FK.
    await queryRunner.query(
      `UPDATE food_variants SET deleted_at = now() WHERE kind = 'option' AND deleted_at IS NULL`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS food_variant_selections`);
    await queryRunner.query(`DROP TABLE IF EXISTS food_variant_groups CASCADE`);
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS group_id`,
    );
    await queryRunner.query(`ALTER TABLE food_variants DROP COLUMN IF EXISTS kind`);

    // A food may only price a given pairing once. Partial so soft-deleted rows
    // don't block re-creating a combination that was removed. Also allows
    // exactly one (NULL, NULL) row per food — the plain, un-optioned item.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_food_items_combination
      ON food_variants (food_id, variant_id, sub_variant_id)
      WHERE deleted_at IS NULL
    `);

    // Price belongs to the food item, so every sellable food needs at least
    // one. Foods that never had variants priced off foods.base_price; give them
    // a plain item carrying that figure so pricing is uniform from here on.
    // base_price stays on foods for compatibility but is no longer the source.
    await queryRunner.query(`
      INSERT INTO food_variants (food_id, name, price, is_default, is_active, sort_order)
      SELECT f.id, f.name, f.base_price, true, f.is_active, 0
        FROM foods f
       WHERE f.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM food_variants v
            WHERE v.food_id = f.id AND v.deleted_at IS NULL
         )
    `);

    // Every food now sells through food_variants.
    await queryRunner.query(`
      UPDATE foods SET has_variants = true
       WHERE deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM food_variants v
            WHERE v.food_id = foods.id AND v.deleted_at IS NULL
         )
    `);
  }

  // Note: down() restores the columns and tables but not the dropped parent_id
  // tree or the soft-deleted option rows' active state — that data is
  // deliberately one-way, since re-creating a CASCADE self-FK would reintroduce
  // the order-history hazard described above.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_food_items_combination`);
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS sub_variant_id`,
    );
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS variant_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS sub_variants`);
    await queryRunner.query(`DROP TABLE IF EXISTS variants`);
  }
}
