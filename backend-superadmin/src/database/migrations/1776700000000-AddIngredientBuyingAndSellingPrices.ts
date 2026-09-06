import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIngredientBuyingAndSellingPrices1776700000000 implements MigrationInterface {
  name = 'AddIngredientBuyingAndSellingPrices1776700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS buying_price numeric(18,4) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS selling_price numeric(18,4) NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      UPDATE ingredients i
      SET selling_price = costs.average_cost
      FROM (
        SELECT ingredient_id,
          CASE WHEN SUM(quantity) > 0
            THEN SUM(quantity * average_cost) / SUM(quantity)
            ELSE 0
          END AS average_cost
        FROM warehouse_ingredient_stocks
        GROUP BY ingredient_id
      ) costs
      WHERE i.id = costs.ingredient_id
        AND i.selling_price = 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ingredients DROP COLUMN IF EXISTS selling_price`);
    await queryRunner.query(`ALTER TABLE ingredients DROP COLUMN IF EXISTS buying_price`);
  }
}
