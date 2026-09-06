import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the first tenant-isolation boundary to every table that already owns
 * an outlet_id.  The tenant is deliberately derived from outlets rather than
 * accepted from API input: an outlet can belong to exactly one tenant.
 *
 * Tables whose ownership is indirect (for example order_items through orders)
 * are handled by a later migration once their complete parent chain is
 * available.  Keeping this migration limited to direct outlet relationships
 * makes the backfill and the database constraint unambiguous.
 */
export class AddTenantOwnershipToOutletTables1777200000000
  implements MigrationInterface
{
  name = 'AddTenantOwnershipToOutletTables1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE outlets
      DROP CONSTRAINT IF EXISTS outlets_tenant_id_id_key
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS outlets_tenant_id_id_key
      ON outlets (tenant_id, id)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_outlet_table_tenant_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        outlet_tenant_id BIGINT;
      BEGIN
        IF NEW.outlet_id IS NULL THEN
          NEW.tenant_id := NULL;
          RETURN NEW;
        END IF;

        SELECT o.tenant_id
          INTO outlet_tenant_id
          FROM outlets o
         WHERE o.id = NEW.outlet_id;

        IF outlet_tenant_id IS NULL THEN
          RAISE EXCEPTION 'Outlet % does not exist or has no tenant', NEW.outlet_id;
        END IF;

        NEW.tenant_id := outlet_tenant_id;
        RETURN NEW;
      END;
      $$
    `);

    // These reporting/cache tables use outlet_id = 0 for the temporary
    // all-outlets aggregate. Until tenant-aware aggregate rows are introduced,
    // keep those rows inside the seeded demo tenant.
    await queryRunner.query(`
      DO $$
      DECLARE
        table_name TEXT;
        demo_tenant_id BIGINT;
      BEGIN
        SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
        IF demo_tenant_id IS NULL THEN
          RAISE EXCEPTION 'The demo tenant is required before tenant ownership migration';
        END IF;

        FOREACH table_name IN ARRAY ARRAY[
          'dashboard_stats_cache',
          'dashboard_chart_cache',
          'dashboard_breakdown_cache',
          'dashboard_inventory_cache',
          'period_insights',
          'period_insights_np'
        ]
        LOOP
          IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id BIGINT', table_name);
            EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', table_name)
              USING demo_tenant_id;
            EXECUTE format(
              'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
              left('idx_' || table_name || '_tenant_id', 63),
              table_name
            );
          END IF;
        END LOOP;
      END
      $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        table_record RECORD;
        constraint_name TEXT;
        trigger_name TEXT;
        index_name TEXT;
      BEGIN
        FOR table_record IN
          SELECT DISTINCT c.table_name
            FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.column_name = 'outlet_id'
             AND c.table_name NOT IN (
               'outlets',
               'dashboard_stats_cache',
               'dashboard_chart_cache',
               'dashboard_breakdown_cache',
               'dashboard_inventory_cache',
               'period_insights',
               'period_insights_np'
             )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id BIGINT',
            table_record.table_name
          );

          -- Some child tables have immutability triggers (for example,
          -- completed order payments). This is a metadata backfill, not a
          -- business mutation, so temporarily suspend user triggers while
          -- setting the derived tenant value.
          EXECUTE format(
            'ALTER TABLE %I DISABLE TRIGGER USER',
            table_record.table_name
          );
          EXECUTE format(
            'UPDATE %I t SET tenant_id = o.tenant_id FROM outlets o WHERE t.outlet_id = o.id AND t.tenant_id IS DISTINCT FROM o.tenant_id',
            table_record.table_name
          );
          EXECUTE format(
            'ALTER TABLE %I ENABLE TRIGGER USER',
            table_record.table_name
          );

          index_name := left('idx_' || table_record.table_name || '_tenant_id', 63);
          EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
            index_name,
            table_record.table_name
          );

          trigger_name := left(table_record.table_name || '_tenant_id_trigger', 63);
          EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I',
            trigger_name,
            table_record.table_name
          );
          EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF outlet_id ON %I FOR EACH ROW EXECUTE FUNCTION set_outlet_table_tenant_id()',
            trigger_name,
            table_record.table_name
          );

          constraint_name := left(table_record.table_name || '_tenant_outlet_fkey', 63);
          EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
            table_record.table_name,
            constraint_name
          );
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets (tenant_id, id)',
            table_record.table_name,
            constraint_name
          );
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
        constraint_name TEXT;
        trigger_name TEXT;
      BEGIN
        FOR table_record IN
          SELECT DISTINCT c.table_name
            FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.column_name = 'outlet_id'
             AND c.table_name NOT IN (
               'outlets',
               'dashboard_stats_cache',
               'dashboard_chart_cache',
               'dashboard_breakdown_cache',
               'dashboard_inventory_cache',
               'period_insights',
               'period_insights_np'
             )
        LOOP
          constraint_name := left(table_record.table_name || '_tenant_outlet_fkey', 63);
          trigger_name := left(table_record.table_name || '_tenant_id_trigger', 63);
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', table_record.table_name, constraint_name);
          EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, table_record.table_name);
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id', table_record.table_name);
        END LOOP;
      END
      $$
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        table_name TEXT;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'dashboard_stats_cache',
          'dashboard_chart_cache',
          'dashboard_breakdown_cache',
          'dashboard_inventory_cache',
          'period_insights',
          'period_insights_np'
        ]
        LOOP
          IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id', table_name);
          END IF;
        END LOOP;
      END
      $$
    `);

    await queryRunner.query(`DROP FUNCTION IF EXISTS set_outlet_table_tenant_id()`);
    await queryRunner.query(`DROP INDEX IF EXISTS outlets_tenant_id_id_key`);
  }
}
