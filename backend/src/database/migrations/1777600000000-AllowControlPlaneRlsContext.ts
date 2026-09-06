import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allows only the dedicated superadmin connection context across tenants. */
export class AllowControlPlaneRlsContext1777600000000 implements MigrationInterface {
  name = 'AllowControlPlaneRlsContext1777600000000';

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
          EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_record.table_name);
          EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.control_plane'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint) WITH CHECK (current_setting(''app.control_plane'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint)',
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
          EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::bigint)',
            table_record.table_name
          );
        END LOOP;
      END
      $$
    `);
  }
}
