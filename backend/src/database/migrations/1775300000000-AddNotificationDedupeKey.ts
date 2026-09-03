import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDedupeKey1775300000000 implements MigrationInterface {
  name = 'AddNotificationDedupeKey1775300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "dedupe_key" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_notifications_dedupe_key" ON "notifications" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_dedupe_key"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "dedupe_key"`);
  }
}
