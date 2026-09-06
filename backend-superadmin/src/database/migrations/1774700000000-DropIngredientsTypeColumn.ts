import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final step of moving `type` off Ingredient onto IngredientCategory (see
 * AddTypeToIngredientCategories1774500000000 and
 * BackfillUncategorizedIngredients1774600000000) — the per-ingredient column
 * is now dead weight, superseded by `ingredient_categories.type` via the
 * mandatory `ingredient_category_id` FK.
 */
export class DropIngredientsTypeColumn1774700000000
  implements MigrationInterface
{
  name = 'DropIngredientsTypeColumn1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients DROP COLUMN IF EXISTS type
    `);
  }

  // Best-effort: restores the column populated from each ingredient's
  // current category type, not the original per-ingredient values from
  // before the move (those are gone once this migration has run).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS type varchar(20)
    `);
    await queryRunner.query(`
      UPDATE ingredients i
      SET type = ic.type
      FROM ingredient_categories ic
      WHERE i.ingredient_category_id = ic.id
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ALTER COLUMN type SET DEFAULT 'raw_material'
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ALTER COLUMN type SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_type_check
      CHECK (type IN ('raw_material', 'ready_product', 'packaging', 'consumable', 'beverage'))
    `);
  }
}
