import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutletSlugs1776100000000 implements MigrationInterface {
  name = 'AddOutletSlugs1776100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE outlets ADD COLUMN IF NOT EXISTS slug varchar(80)`);
    await queryRunner.query(`
      WITH normalized AS (
        SELECT id,
          COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g')), ''), 'outlet') AS base
        FROM outlets
      ), assigned AS (
        SELECT id, CASE WHEN COUNT(*) OVER (PARTITION BY base) > 1 THEN LEFT(base, 70) || '-' || id::text ELSE LEFT(base, 80) END AS slug
        FROM normalized
      )
      UPDATE outlets o SET slug = a.slug FROM assigned a WHERE o.id = a.id AND o.slug IS NULL
    `);
    await queryRunner.query(`ALTER TABLE outlets ALTER COLUMN slug SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS outlets_slug_unique ON outlets (slug)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS outlets_slug_unique`);
    await queryRunner.query(`ALTER TABLE outlets DROP COLUMN IF EXISTS slug`);
  }
}
