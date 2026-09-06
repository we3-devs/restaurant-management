import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Roles previously had no explicit signal for which frontend app their
 * holders belong in — the frontend guessed from the role's permission set,
 * which broke for any custom role (permissions are fully admin-configurable
 * via the Roles UI, so no fixed permission whitelist can reliably
 * distinguish "staff PWA" from "desktop dashboard"). This adds an explicit
 * `portal` column so that decision is made by the admin at role-creation
 * time instead of inferred.
 */
export class AddPortalToRoles1772100000000 implements MigrationInterface {
  name = 'AddPortalToRoles1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE roles ADD COLUMN portal VARCHAR(20) NOT NULL DEFAULT 'dashboard'`,
    );
    await queryRunner.query(
      `ALTER TABLE roles ADD CONSTRAINT roles_portal_check CHECK (portal IN ('dashboard', 'staff', 'both'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_portal_check`,
    );
    await queryRunner.query(`ALTER TABLE roles DROP COLUMN IF EXISTS portal`);
  }
}
