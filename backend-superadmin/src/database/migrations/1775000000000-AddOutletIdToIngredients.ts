import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ingredients were a global catalog with globally-unique slug/code/barcode —
 * meaning any outlet could see and edit any other outlet's ingredients, and
 * two outlets could never have their own "Tomato" ingredient. This makes
 * ingredients outlet-scoped like warehouses: adds outlet_id (backfilled to
 * the earliest-created outlet for existing rows, then locked NOT NULL),
 * replaces the global unique constraints with per-outlet ones, and adds a
 * partial unique index for barcode (still globally unique among non-null
 * values per outlet, not across outlets).
 */
export class AddOutletIdToIngredients1775000000000
  implements MigrationInterface
{
  name = 'AddOutletIdToIngredients1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingredients ADD COLUMN outlet_id BIGINT
    `);

    await queryRunner.query(`
      UPDATE ingredients
      SET outlet_id = (SELECT id FROM outlets ORDER BY id ASC LIMIT 1)
      WHERE outlet_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingredients ALTER COLUMN outlet_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_outlet_id_foreign
        FOREIGN KEY (outlet_id) REFERENCES outlets(id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ingredients_outlet_id ON ingredients(outlet_id)
    `);

    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_slug_key
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_code_key
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_barcode_key
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_ingredients_outlet_slug ON ingredients(outlet_id, slug)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_ingredients_outlet_code ON ingredients(outlet_id, code)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_ingredients_outlet_barcode
        ON ingredients(outlet_id, barcode) WHERE barcode IS NOT NULL
    `);
  }

  // Not reversible: which outlet each ingredient "should" belong to isn't
  // tracked once backfilled, so down() only restores the global schema shape
  // — it can't undo the outlet assignment. Restoring the global unique
  // constraints will fail if any duplicate slug/code/barcode now exists
  // across outlets.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_ingredients_outlet_barcode
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_ingredients_outlet_code
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_ingredients_outlet_slug
    `);

    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_slug_key UNIQUE (slug)
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_code_key UNIQUE (code)
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients ADD CONSTRAINT ingredients_barcode_key UNIQUE (barcode)
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_ingredients_outlet_id
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_outlet_id_foreign
    `);
    await queryRunner.query(`
      ALTER TABLE ingredients DROP COLUMN IF EXISTS outlet_id
    `);
  }
}
