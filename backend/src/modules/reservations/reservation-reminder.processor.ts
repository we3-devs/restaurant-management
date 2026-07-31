import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationsService } from './reservations.service';

export interface ReservationReminderJobData {
  reservationId: number;
}

@Processor('reservation-reminders')
export class ReservationReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationReminderProcessor.name);

  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {
    super();
  }

  async process(job: Job<ReservationReminderJobData>): Promise<void> {
    const reservation = await this.reservationsService
      .findOne(job.data.reservationId)
      .catch(() => null);
    // Already cancelled/completed (or deleted) — the job wasn't removed in
    // time, just drop it silently rather than notifying about a stale booking.
    if (!reservation || reservation.status !== 'confirmed') {
      return;
    }

    const notification = await this.notificationsService.create({
      outletId: reservation.outletId,
      type: 'reservation_reminder',
      priority: 'high',
      title: `Upcoming reservation for ${reservation.guestCount} guest(s)`,
      body: `Reserved for ${new Date(reservation.reservedAt).toLocaleTimeString()}`,
      data: JSON.stringify({ reservationId: reservation.id }),
    });
    this.gateway.notifyNotificationCreated(notification);
    this.logger.log(`Reminder sent for reservation ${reservation.id}`);
  }
}
