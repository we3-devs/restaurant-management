import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoodInventoryIngredient1776800000000 implements MigrationInterface {
  name = 'AddFoodInventoryIngredient1776800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS inventory_ingredient_id bigint NULL REFERENCES ingredients(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_foods_inventory_ingredient_id ON foods(inventory_ingredient_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_foods_inventory_ingredient_id`);
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS inventory_ingredient_id`);
  }
}
