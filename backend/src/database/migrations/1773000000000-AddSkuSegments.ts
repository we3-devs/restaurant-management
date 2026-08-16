import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-level SKU segments, composed into the existing `sku` column.
 *
 * Operators were already hand-typing composed codes (MOMO-001, CHI-MOMO-FULL,
 * and drifting variants like "8848-full" and a "SPI-MINI" typo for Sprite).
 * A segment per level — MOMO / CHI / FULL — lets the backend join the path and
 * keep them consistent.
 *
 * `sku_segment` is deliberately NOT unique: "FULL" legitimately repeats across
 * every dish. The composed value lands in `sku`, which keeps its UNIQUE index
 * because MOMO-CHI-FULL and PIZZA-CHI-FULL differ.
 *
 * Nothing is backfilled. A NULL segment means "leave `sku` alone", so every
 * existing hand-entered code keeps working untouched and composition only
 * starts once someone fills a segment in.
 */
export class AddSkuSegments1773000000000 implements MigrationInterface {
  name = 'AddSkuSegments1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE foods
      ADD COLUMN IF NOT EXISTS sku_segment VARCHAR(32)
    `);
    await queryRunner.query(`
      ALTER TABLE food_variants
      ADD COLUMN IF NOT EXISTS sku_segment VARCHAR(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE food_variants DROP COLUMN IF EXISTS sku_segment`,
    );
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS sku_segment`);
  }
}
