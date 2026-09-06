import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces BullMQ's delayed+cancellable `reservation-reminders` job (which
 * required Redis) with a plain periodic scan — see
 * ReservationReminderScheduler. `reminder_sent_at` is stamped immediately
 * after a reminder is sent, which is what makes the scan safe to run every
 * minute without ever double-sending, and safe across a server restart
 * (nothing was "in flight" the way a delayed job would have been).
 */
export class AddReminderSentAtToReservations1772500000000
  implements MigrationInterface
{
  name = 'AddReminderSentAtToReservations1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reservations ADD COLUMN reminder_sent_at TIMESTAMP NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_reservations_reminder_scan
        ON reservations(status, reminder_sent_at, reserved_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_reservations_reminder_scan`,
    );
    await queryRunner.query(
      `ALTER TABLE reservations DROP COLUMN IF EXISTS reminder_sent_at`,
    );
  }
}
