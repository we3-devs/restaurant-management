import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { Reservation } from './entities/reservation.entity';

const SCAN_INTERVAL_MS = 60_000;
const REMINDER_OFFSET_MS = 30 * 60_000;

/**
 * Replaces BullMQ's `reservation-reminders` queue (a delayed job scheduled
 * per reservation at booking time, cancelled via `queue.remove` on
 * status change). A per-reservation delayed job doesn't survive a server
 * restart and reservations can be booked days out, so this redesigns it as
 * a periodic scan instead: every minute, find confirmed reservations
 * entering their 30-minute reminder window that haven't been reminded yet,
 * send the reminder, and stamp `reminderSentAt` immediately so the scan can
 * never double-send. "Cancellation" is implicit — a reservation that's been
 * cancelled/completed/seated/no-showed simply stops matching
 * `status = 'confirmed'`, the same guard the old BullMQ processor checked
 * at fire time.
 */
@Injectable()
export class ReservationReminderScheduler {
  private readonly logger = new Logger(ReservationReminderScheduler.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  @Interval(SCAN_INTERVAL_MS)
  async scan(): Promise<void> {
    try {
      await this.runScan();
    } catch (err) {
      this.logger.error(`Reservation reminder scan failed: ${(err as Error).message}`);
    }
  }

  private async runScan(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_OFFSET_MS);

    const due = await this.reservationsRepository.find({
      where: {
        status: 'confirmed',
        reminderSentAt: IsNull(),
        reservedAt: LessThanOrEqual(windowEnd) as unknown as Date,
      },
    });
    // LessThanOrEqual alone would also catch already-past reservations that
    // were never sent for some reason (e.g. the app was down through their
    // window) — MoreThan(now) keeps this scan focused on genuinely upcoming
    // ones, matching the old job's "delay <= 0 => don't schedule" no-op.
    const upcoming = due.filter((r) => new Date(r.reservedAt) > now);

    for (const reservation of upcoming) {
      const notification = await this.notificationsService.create({
        outletId: reservation.outletId,
        type: 'reservation_reminder',
        dedupeKey: `reservation-reminder:${reservation.id}`,
        priority: 'high',
        title: `Upcoming reservation for ${reservation.guestCount} guest(s)`,
        body: `Reserved for ${new Date(reservation.reservedAt).toLocaleTimeString()}`,
        data: JSON.stringify({ reservationId: reservation.id }),
      });
      this.gateway.notifyNotificationCreated(notification);
      await this.reservationsRepository.update(reservation.id, {
        reminderSentAt: new Date(),
      });
      this.logger.log(`Reminder sent for reservation ${reservation.id}`);
    }
  }
}
