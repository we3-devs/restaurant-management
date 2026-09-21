import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant-scopes variants.name, sub_variants.name, and food_variants.sku.
 *
 * These three columns still carried the GLOBAL unique indexes/constraints
 * from before tenant_id existed on these tables, while every application
 * query against them (VariantsService, FoodsImporter) has scoped reads and
 * writes by tenant for a while now — see scopedWhere/tenantFields call sites
 * in variants.service.ts and foods/import/foods-importer.ts.
 *
 * That mismatch meant a second tenant naming a variant "Full" (or landing on
 * the same derived food_variants SKU) hit the other tenant's global unique
 * index and failed with a duplicate-key error, despite being unique within
 * its own tenant. Sibling migration TenantScopeFoods1780200000000 already
 * did the equivalent for foods.slug three days earlier; this closes the gap
 * for the remaining three columns.
 *
 * Existing rows with NULL tenant_id are legacy global rows (from before
 * tenant_id was backfilled) — assigned to the demo tenant, same fallback
 * used by TenantScopeFoods.
 */
export class TenantScopeVariantsAndSku1781800000000
  implements MigrationInterface
{
  name = 'TenantScopeVariantsAndSku1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['variants', 'sub_variants']) {
      await queryRunner.query(`
        UPDATE ${table}
        SET tenant_id = COALESCE(
          tenant_id,
          (SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1),
          (SELECT MIN(id) FROM tenants)
        )
        WHERE tenant_id IS NULL
      `);
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN tenant_id SET NOT NULL`);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE ${table} ADD CONSTRAINT ${table}_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);

      // Drop the old global unique index (created by
      // AddGlobalVariantsAndFoodItems1773200000000 as uq_${table}_name) and
      // replace it with one scoped to (tenant_id, lower(name)).
      await queryRunner.query(`DROP INDEX IF EXISTS uq_${table}_name`);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_${table}_tenant_name
        ON ${table} (tenant_id, lower(name))
      `);
    }

    // food_variants.sku: drop whatever unique constraint/index currently
    // covers it (name varies — it predates the migration files in this repo)
    // and replace with one scoped to (tenant_id, sku).
    await queryRunner.query(`
      DO $$
      DECLARE
        cons RECORD;
      BEGIN
        FOR cons IN
          SELECT conname FROM pg_constraint
           WHERE conrelid = 'food_variants'::regclass
             AND contype = 'u'
             AND conkey = (
               SELECT array_agg(attnum) FROM pg_attribute
                WHERE attrelid = 'food_variants'::regclass AND attname = 'sku'
             )
        LOOP
          EXECUTE format('ALTER TABLE food_variants DROP CONSTRAINT %I', cons.conname);
        END LOOP;

        FOR cons IN
          SELECT indexname AS conname FROM pg_indexes
           WHERE tablename = 'food_variants' AND indexdef ILIKE '%UNIQUE%(sku)%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', cons.conname);
        END LOOP;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_food_variants_tenant_sku
      ON food_variants (tenant_id, sku)
      WHERE sku IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_food_variants_tenant_sku`);
    await queryRunner.query(`ALTER TABLE food_variants ADD CONSTRAINT food_variants_sku_key UNIQUE (sku)`);

    for (const table of ['variants', 'sub_variants']) {
      await queryRunner.query(`DROP INDEX IF EXISTS uq_${table}_tenant_name`);
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_${table}_name ON ${table} (lower(name))`);
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_tenant_id_fkey`);
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN tenant_id DROP NOT NULL`);
    }
  }
}
