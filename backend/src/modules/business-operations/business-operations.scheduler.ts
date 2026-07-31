import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Registers all repeatable business-operations scans once on boot (see KitchenDelayScanScheduler for the base pattern). */
@Injectable()
export class BusinessOperationsScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('business-operations') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'overdue-purchase-orders-scan',
      { every: 30 * MINUTE },
      { name: 'overdue-purchase-orders' },
    );
    await this.queue.upsertJobScheduler(
      'upcoming-deliveries-scan',
      { every: HOUR },
      { name: 'upcoming-deliveries' },
    );
    await this.queue.upsertJobScheduler(
      'shift-reminders-scan',
      { every: 15 * MINUTE },
      { name: 'shift-reminders' },
    );
    await this.queue.upsertJobScheduler(
      'attendance-summary-scan',
      { every: 24 * HOUR },
      { name: 'attendance-summary' },
    );
    await this.queue.upsertJobScheduler(
      'daily-purchase-summary-scan',
      { every: 24 * HOUR },
      { name: 'daily-purchase-summary' },
    );
    await this.queue.upsertJobScheduler(
      'outstanding-supplier-alerts-scan',
      { every: 6 * HOUR },
      { name: 'outstanding-supplier-alerts' },
    );
  }
}
