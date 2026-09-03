import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceFoodRecipeFlagWithItemType1775800000000 implements MigrationInterface {
  name = 'ReplaceFoodRecipeFlagWithItemType1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_item_type_check`);
    await queryRunner.query(`
      UPDATE foods
      SET item_type = CASE
        WHEN department_type IS NULL THEN 'ready_made'
        ELSE 'kitchen'
      END
    `);
    await queryRunner.query(`ALTER TABLE foods ADD CONSTRAINT foods_item_type_check CHECK (item_type IN ('kitchen', 'ready_made'))`);
    await queryRunner.query(`ALTER TABLE foods DROP COLUMN IF EXISTS is_recipe_enabled`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS is_recipe_enabled boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_item_type_check`);
    await queryRunner.query(`ALTER TABLE foods ADD CONSTRAINT foods_item_type_check CHECK (item_type IN ('food', 'beverage', 'combo'))`);
    await queryRunner.query(`UPDATE foods SET item_type = 'food' WHERE item_type IN ('kitchen', 'ready_made')`);
  }
}
