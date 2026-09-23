import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryKitTables1782000000000 implements MigrationInterface {
  name = 'CreateInventoryKitTables1782000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_kits (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inventory_kits_tenant_id ON inventory_kits(tenant_id)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_kits_tenant_slug
        ON inventory_kits(tenant_id, slug) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_kit_items (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
        kit_id BIGINT NOT NULL REFERENCES inventory_kits(id) ON DELETE CASCADE,
        ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
        label VARCHAR(100) NOT NULL,
        unit_id BIGINT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(kit_id, ingredient_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inventory_kit_items_kit_id ON inventory_kit_items(kit_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inventory_kit_items_ingredient_id ON inventory_kit_items(ingredient_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_kit_portions (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
        kit_item_id BIGINT NOT NULL REFERENCES inventory_kit_items(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        unit_id BIGINT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
        quantity DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inventory_kit_portions_kit_item_id ON inventory_kit_portions(kit_item_id)`);

    await queryRunner.query(`
      INSERT INTO permissions (name, slug, module, action, level, is_system, is_active, description)
      VALUES
        ('View Inventory Kits', 'inventory-kits.view', 'inventory-kits', 'view', 'global', TRUE, TRUE, 'Allows viewing inventory kits, their variances and portions'),
        ('Manage Inventory Kits', 'inventory-kits.manage', 'inventory-kits', 'manage', 'global', TRUE, TRUE, 'Allows creating, editing and deleting inventory kits, their variances and portions')
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        module = EXCLUDED.module,
        action = EXCLUDED.action,
        is_active = TRUE,
        description = EXCLUDED.description
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE slug IN ('inventory-kits.view', 'inventory-kits.manage'))
    `);
    await queryRunner.query(`DELETE FROM permissions WHERE slug IN ('inventory-kits.view', 'inventory-kits.manage')`);

    await queryRunner.query(`DROP TABLE IF EXISTS inventory_kit_portions`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_kit_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_kits`);
  }
}
