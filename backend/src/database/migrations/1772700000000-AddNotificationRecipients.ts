import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNotificationRecipients1772700000000 implements MigrationInterface {
  name = 'AddNotificationRecipients1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'notifications',
      new TableColumn({
        name: 'recipient_user_ids',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    // Backfill existing rows so the new recipient boundary also applies to
    // notifications created before this migration existed.
    await queryRunner.query(`
      UPDATE notifications AS n
      SET recipient_user_ids = COALESCE((
        SELECT jsonb_agg(to_jsonb(u.id))
        FROM users AS u
        WHERE u.is_superadmin = true
           OR EXISTS (
             SELECT 1
             FROM user_role_assignments AS a
             INNER JOIN roles AS r ON r.id = a.role_id
             WHERE a.user_id = u.id
               AND a.outlet_id = n.outlet_id
               AND a.is_active = true
               AND r.is_active = true
           )
      ), '[]'::jsonb)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('notifications', 'recipient_user_ids');
  }
}
