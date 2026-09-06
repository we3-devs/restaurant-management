import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables strict tenant RLS for every application table carrying tenant_id.
 *
 * The policy intentionally has no NULL/empty fallback. Callers must set
 * app.tenant_id on the active PostgreSQL session/transaction before querying
 * tenant-owned data.
 */
export class EnableStrictTenantRls1777400000000 implements MigrationInterface {
  name = 'EnableStrictTenantRls1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
             AND c.table_name NOT IN ('tenants', 'migrations', 'typeorm_migrations')
        LOOP
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_record.table_name);
          EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_record.table_name);
          EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_record.table_name);
          EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint)',
            table_record.table_name
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
      BEGIN
        FOR table_record IN
          SELECT DISTINCT c.table_name
            FROM information_schema.columns c
           WHERE c.table_schema = 'public'
             AND c.column_name = 'tenant_id'
             AND c.table_name NOT IN ('tenants', 'migrations', 'typeorm_migrations')
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_record.table_name);
          EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', table_record.table_name);
          EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_record.table_name);
        END LOOP;
      END
      $$
    `);
  }
}
