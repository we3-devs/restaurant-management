import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops food_variants.sku_segment.
 *
 * A food item's code is exactly food-variant-subvariant. The item having a
 * segment of its own would add a fourth part and break that format — it was a
 * leftover from the abandoned design where each item carried its own piece.
 * The item *is* the triple, so it has nothing of its own to contribute.
 *
 * Segments now live only on `foods`, `variants` and `sub_variants`.
 */
export class DropFoodItemSkuSegment1773500000000 implements MigrationInterface {
  name = 'DropFoodItemSkuSegment1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS sku_segment`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE food_variants ADD COLUMN IF NOT EXISTS sku_segment VARCHAR(32)`,
    );
  }
}
