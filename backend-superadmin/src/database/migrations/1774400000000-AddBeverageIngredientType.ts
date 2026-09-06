import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `ingredients_type_check` constraint predates the TypeORM entity (added
 * directly in the database, not by a prior migration) and only allowed the
 * original four types. IngredientType now also includes 'beverage' — see
 * ingredient-type.util.ts — so the constraint must be widened or every
 * insert/update with type='beverage' fails at the DB layer regardless of
 * application-level validation.
 */
export class AddBeverageIngredientType1774400000000
  implements MigrationInterface
{
  name = 'AddBeverageIngredientType1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_type_check
      CHECK (type IN ('raw_material', 'ready_product', 'packaging', 'consumable', 'beverage'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_type_check
      CHECK (type IN ('raw_material', 'ready_product', 'packaging', 'consumable'))
    `);
  }
}
