import { MigrationInterface, QueryRunner } from 'typeorm';

/** Food-level type, price, and derived SKU are obsolete: type and pricing
 * belong to food items, while skuSegment is the food-level SKU source. */
export class RemoveFoodLevelTypeAndPrice1779000000000 implements MigrationInterface {
  name = 'RemoveFoodLevelTypeAndPrice1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS food_type`);
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS base_price`);
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS sku`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS food_type VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS base_price NUMERIC(12, 2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS sku VARCHAR(255) UNIQUE`);
  }
}
