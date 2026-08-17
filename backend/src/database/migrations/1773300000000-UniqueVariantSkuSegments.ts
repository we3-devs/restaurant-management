import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A SKU segment must identify exactly one list value.
 *
 * Without this, two variants could both carry "VEG" and every food item using
 * either would compose to the same code — either colliding against
 * food_variants' unique sku or, worse, producing two menu items that print the
 * same SKU on a receipt.
 *
 * Partial index: NULL segments are the norm (a list value that never appears in
 * a SKU), and many NULLs must remain allowed.
 */
export class UniqueVariantSkuSegments1773300000000
  implements MigrationInterface
{
  name = 'UniqueVariantSkuSegments1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['variants', 'sub_variants']) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_${table}_sku_segment
        ON ${table} (lower(sku_segment))
        WHERE sku_segment IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['variants', 'sub_variants']) {
      await queryRunner.query(`DROP INDEX IF EXISTS uq_${table}_sku_segment`);
    }
  }
}
