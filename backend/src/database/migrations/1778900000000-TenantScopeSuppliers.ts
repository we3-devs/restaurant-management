import { MigrationInterface, QueryRunner } from 'typeorm';

/** Makes inventory master data tenant-owned instead of globally shared. */
export class TenantScopeSuppliers1778900000000 implements MigrationInterface {
  name = 'TenantScopeSuppliers1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // These columns are normally added by the general tenant rollout. Keep
    // this migration safe for databases created from an older schema too.
    await queryRunner.query(`
      ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
      ALTER TABLE unit_conversions ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
    `);
    await queryRunner.query(`
      ALTER TABLE supplier_categories ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
      ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
    `);

    // Units have no outlet parent; legacy rows belong to the demo tenant.
    await queryRunner.query(`
      UPDATE units
         SET tenant_id = COALESCE(
           tenant_id,
           (SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1),
           (SELECT MIN(id) FROM tenants)
         )
       WHERE tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE unit_conversions c
         SET tenant_id = u.tenant_id
        FROM units u
       WHERE c.from_unit_id = u.id
         AND c.tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE ingredients i
         SET tenant_id = COALESCE(o.tenant_id, (SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1), (SELECT MIN(id) FROM tenants))
        FROM outlets o
       WHERE i.outlet_id = o.id
         AND i.tenant_id IS NULL
    `);

    // Suppliers already belong to an outlet, and outlets are tenant-owned.
    await queryRunner.query(`
      UPDATE suppliers s
         SET tenant_id = o.tenant_id
        FROM outlets o
       WHERE s.outlet_id = o.id
         AND s.tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE suppliers
         SET tenant_id = COALESCE((SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1), (SELECT MIN(id) FROM tenants))
       WHERE tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE supplier_categories c
         SET tenant_id = source.tenant_id
        FROM (
          SELECT category_id, MIN(tenant_id) AS tenant_id
            FROM suppliers
           WHERE category_id IS NOT NULL AND tenant_id IS NOT NULL
           GROUP BY category_id
        ) source
       WHERE c.id = source.category_id
         AND c.tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE supplier_categories
         SET tenant_id = COALESCE((SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1), (SELECT MIN(id) FROM tenants))
       WHERE tenant_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE supplier_documents d
         SET tenant_id = s.tenant_id
        FROM suppliers s
       WHERE d.supplier_id = s.id
         AND d.tenant_id IS NULL
    `);

    await queryRunner.query(`ALTER TABLE supplier_categories ALTER COLUMN tenant_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE suppliers ALTER COLUMN tenant_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE supplier_documents ALTER COLUMN tenant_id SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_supplier_no_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS suppliers_supplier_no_key`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_tenant_supplier_no ON suppliers(tenant_id, supplier_no)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_supplier_categories_tenant_id ON supplier_categories(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_supplier_documents_tenant_id ON supplier_documents(tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_supplier_documents_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_suppliers_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_supplier_categories_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_suppliers_tenant_supplier_no`);
    await queryRunner.query(`ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_no_key UNIQUE (supplier_no)`);
    await queryRunner.query(`ALTER TABLE supplier_documents DROP COLUMN IF EXISTS tenant_id`);
    await queryRunner.query(`ALTER TABLE suppliers DROP COLUMN IF EXISTS tenant_id`);
    await queryRunner.query(`ALTER TABLE supplier_categories DROP COLUMN IF EXISTS tenant_id`);
  }
}
