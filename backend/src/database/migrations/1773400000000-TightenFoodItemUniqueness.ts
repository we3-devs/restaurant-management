import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the food-item combination index treat NULLs as equal.
 *
 * A plain unique index does not stop duplicates when part of the key is NULL —
 * Postgres considers each NULL distinct — so a food could hold two items at
 * (food, chicken, NULL) or two un-optioned items, both of which are the same
 * sellable thing priced twice.
 *
 * NULLS NOT DISTINCT requires Postgres 15+; this database is on 17.
 */
export class TightenFoodItemUniqueness1773400000000
  implements MigrationInterface
{
  name = 'TightenFoodItemUniqueness1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_food_items_combination`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_food_items_combination
      ON food_variants (food_id, variant_id, sub_variant_id) NULLS NOT DISTINCT
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_food_items_combination`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_food_items_combination
      ON food_variants (food_id, variant_id, sub_variant_id)
      WHERE deleted_at IS NULL
    `);
  }
}
