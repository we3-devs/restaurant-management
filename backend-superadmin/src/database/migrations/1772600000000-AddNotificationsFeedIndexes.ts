import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * The notifications table (`notifications`) shipped with no indexes beyond
 * its primary key — every list/unread-count query from
 * NotificationsService.findAll() (GET /notifications, and the header bell's
 * small-limit variant) does a full sequential scan filtered by
 * outlet/read/archived and sorted by created_at. Cheap at today's row count,
 * but this is the feed every staff member's browser polls/hits on every
 * page, so it only gets worse as the table grows.
 */
export class AddNotificationsFeedIndexes1772600000000 implements MigrationInterface {
  name = 'AddNotificationsFeedIndexes1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Covers the main feed query: outlet + archived filter, sorted by
    // created_at DESC (findAll's default, non-unreadOnly path).
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_outlet_archived_created',
        columnNames: ['outlet_id', 'archived_at', 'created_at'],
      }),
    );

    // Covers unreadOnly/read=false filtering and the separate unreadCount
    // query, both of which key off (outlet_id, read_at, archived_at).
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_outlet_read_archived',
        columnNames: ['outlet_id', 'read_at', 'archived_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_outlet_read_archived',
    );
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_outlet_archived_created',
    );
  }
}
