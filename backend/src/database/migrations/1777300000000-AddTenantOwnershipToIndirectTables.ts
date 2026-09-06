import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completes the tenant column rollout for tables that inherit ownership from
 * another record instead of storing outlet_id themselves.
 */
export class AddTenantOwnershipToIndirectTables1777300000000
  implements MigrationInterface
{
  name = 'AddTenantOwnershipToIndirectTables1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_parent_tenant_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        parent_id BIGINT;
        parent_tenant_id BIGINT;
      BEGIN
        parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::BIGINT;
        IF parent_id IS NULL THEN
          RAISE EXCEPTION 'Cannot derive tenant for %.%: parent key % is null',
            TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[1];
        END IF;

        EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', TG_ARGV[0])
          INTO parent_tenant_id
          USING parent_id;

        IF parent_tenant_id IS NULL THEN
          RAISE EXCEPTION 'Cannot derive tenant for %.%: parent % % has no tenant',
            TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[0], parent_id;
        END IF;

        NEW.tenant_id := parent_tenant_id;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_default_demo_tenant_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.tenant_id IS NULL THEN
          SELECT id INTO NEW.tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        table_record RECORD;
        mapping RECORD;
        trigger_name TEXT;
        index_name TEXT;
      BEGIN
        -- Every application table gets a tenant column. Control-plane and
        -- TypeORM bookkeeping tables are intentionally excluded.
        FOR table_record IN
          SELECT DISTINCT c.table_name
            FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.table_name NOT IN (
               'tenants', 'outlets', 'users', 'migrations', 'typeorm_migrations'
             )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id BIGINT',
            table_record.table_name
          );
          index_name := left('idx_' || table_record.table_name || '_tenant_id', 63);
          EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
            index_name,
            table_record.table_name
          );
        END LOOP;

        -- Parent mappings are ordered from direct outlet-owned parents to
        -- deeper children so the backfill can follow the chain.
        FOR mapping IN
          SELECT * FROM (VALUES
            ('order_items', 'orders', 'order_id'),
            ('order_item_addons', 'order_items', 'order_item_id'),
            ('order_item_ingredient_reservations', 'order_items', 'order_item_id'),
            ('order_status_histories', 'orders', 'order_id'),
            ('table_session_customers', 'table_sessions', 'table_session_id'),
            ('reservation_tables', 'reservations', 'reservation_id'),
            ('shift_assignments', 'shifts', 'shift_id'),
            ('employee_documents', 'employees', 'employee_id'),
            ('employee_department_assignments', 'employees', 'employee_id'),
            ('goods_receiving_items', 'goods_receivings', 'goods_receiving_id'),
            ('purchase_order_items', 'purchase_orders', 'purchase_order_id'),
            ('purchase_return_items', 'purchase_returns', 'purchase_return_id'),
            ('supplier_documents', 'suppliers', 'supplier_id'),
            ('warehouse_ingredient_stocks', 'warehouses', 'warehouse_id'),
            ('ingredient_inventory_transactions', 'warehouses', 'warehouse_id'),
            ('ingredient_stock_ins', 'warehouses', 'warehouse_id'),
            ('ingredient_stock_outs', 'warehouses', 'warehouse_id'),
            ('ingredient_stock_counts', 'warehouses', 'warehouse_id'),
            ('ingredient_stock_adjustments', 'warehouses', 'warehouse_id'),
            ('ingredient_stock_transfers', 'warehouses', 'from_warehouse_id'),
            ('ingredient_stock_in_items', 'ingredient_stock_ins', 'stock_in_id'),
            ('ingredient_stock_out_items', 'ingredient_stock_outs', 'stock_out_id'),
            ('ingredient_stock_count_items', 'ingredient_stock_counts', 'stock_count_id'),
            ('ingredient_stock_adjustment_items', 'ingredient_stock_adjustments', 'stock_adjustment_id'),
            ('ingredient_stock_transfer_items', 'ingredient_stock_transfers', 'stock_transfer_id'),
            ('loyalty_transactions', 'loyalty_accounts', 'loyalty_account_id'),
            ('customer_credit_transactions', 'customer_credit_accounts', 'account_id'),
            ('push_subscriptions', 'users', 'user_id'),
            ('notification_preferences', 'users', 'user_id'),
            ('refresh_tokens', 'users', 'user_id'),
            ('food_recipes', 'foods', 'food_id'),
            ('food_addon_groups', 'foods', 'food_id'),
            ('food_variants', 'foods', 'food_id'),
            ('sub_variants', 'variants', 'variant_id'),
            ('role_permissions', 'roles', 'role_id'),
            ('import_job_rows', 'import_jobs', 'job_id')
          ) AS m(child_table, parent_table, parent_key)
        LOOP
          IF to_regclass(format('public.%I', mapping.child_table)) IS NULL
             OR to_regclass(format('public.%I', mapping.parent_table)) IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = mapping.child_table
                  AND column_name = mapping.parent_key
             )
          THEN
            CONTINUE;
          END IF;

          EXECUTE format('ALTER TABLE %I DISABLE TRIGGER USER', mapping.child_table);
          EXECUTE format(
            'UPDATE %I child SET tenant_id = parent.tenant_id FROM %I parent WHERE child.%I = parent.id AND parent.tenant_id IS NOT NULL AND child.tenant_id IS DISTINCT FROM parent.tenant_id',
            mapping.child_table,
            mapping.parent_table,
            mapping.parent_key
          );
          EXECUTE format('ALTER TABLE %I ENABLE TRIGGER USER', mapping.child_table);

          trigger_name := left(mapping.child_table || '_parent_tenant_trigger', 63);
          EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, mapping.child_table);
          EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON %I FOR EACH ROW EXECUTE FUNCTION set_parent_tenant_id(%L, %L)',
            trigger_name,
            mapping.parent_key,
            mapping.child_table,
            mapping.parent_table,
            mapping.parent_key
          );
        END LOOP;

        -- Existing rows in tables without a usable parent chain are legacy
        -- global/unscoped records. Keep them inside demo until they are
        -- explicitly split by tenant.
        FOR table_record IN
          SELECT DISTINCT c.table_name
           FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.column_name = 'tenant_id'
             AND c.table_name NOT IN ('tenants', 'outlets', 'users')
             AND NOT EXISTS (
               SELECT 1 FROM information_schema.columns outlet_column
                WHERE outlet_column.table_schema = 'public'
                  AND outlet_column.table_name = c.table_name
                  AND outlet_column.column_name = 'outlet_id'
             )
        LOOP
          EXECUTE format(
            'UPDATE %I SET tenant_id = (SELECT id FROM tenants WHERE slug = ''demo'' LIMIT 1) WHERE tenant_id IS NULL',
            table_record.table_name
          );
          trigger_name := left(table_record.table_name || '_default_demo_tenant_trigger', 63);
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = table_record.table_name
               AND column_name = 'outlet_id'
          ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, table_record.table_name);
            EXECUTE format(
              'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_demo_tenant_id()',
              trigger_name,
              table_record.table_name
            );
          END IF;
        END LOOP;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        table_record RECORD;
      BEGIN
        FOR table_record IN
          SELECT DISTINCT c.table_name
            FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.column_name = 'tenant_id'
             AND c.table_name NOT IN ('tenants', 'outlets', 'users')
             AND NOT EXISTS (
               SELECT 1 FROM information_schema.columns outlet_column
                WHERE outlet_column.table_schema = 'public'
                  AND outlet_column.table_name = c.table_name
                  AND outlet_column.column_name = 'outlet_id'
             )
        LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', left(table_record.table_name || '_default_demo_tenant_trigger', 63), table_record.table_name);
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id', table_record.table_name);
        END LOOP;
      END
      $$
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_parent_tenant_id() CASCADE`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_default_demo_tenant_id() CASCADE`);
  }
}
