import { MigrationInterface, QueryRunner } from 'typeorm';

/** Replaces the previously applied trigger with the corrected superadmin rule. */
export class FixControlPlaneRefreshTokenTrigger1777800000000
  implements MigrationInterface
{
  name = 'FixControlPlaneRefreshTokenTrigger1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_parent_tenant_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        parent_id BIGINT;
        parent_tenant_id BIGINT;
        parent_is_superadmin BOOLEAN := false;
      BEGIN
        parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::BIGINT;
        IF parent_id IS NULL THEN
          RAISE EXCEPTION 'Cannot derive tenant for %.%: parent key % is null',
            TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[1];
        END IF;

        IF TG_ARGV[0] = 'users' THEN
          EXECUTE 'SELECT tenant_id, is_superadmin FROM users WHERE id = $1'
            INTO parent_tenant_id, parent_is_superadmin
            USING parent_id;
        ELSE
          EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', TG_ARGV[0])
            INTO parent_tenant_id
            USING parent_id;
        END IF;

        IF parent_tenant_id IS NULL
           AND TG_ARGV[0] = 'users'
           AND parent_is_superadmin THEN
          NEW.tenant_id := NULL;
          RETURN NEW;
        END IF;

        IF parent_tenant_id IS NULL THEN
          RAISE EXCEPTION 'Cannot derive tenant for %.%: parent % % has no tenant',
            TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[0], parent_id;
        END IF;

        NEW.tenant_id := parent_tenant_id;
        RETURN NEW;
      END;
      $$
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The prior trigger implementation is intentionally not restored because
    // it prevents valid control-plane sessions from creating refresh tokens.
  }
}
