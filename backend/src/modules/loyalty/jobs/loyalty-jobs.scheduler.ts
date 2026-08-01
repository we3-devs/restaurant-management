import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

const DAY = 24 * 60 * 60_000;

/** Registers the repeatable loyalty background scans once on boot (see BusinessOperationsScheduler for the base pattern). */
@Injectable()
export class LoyaltyJobsScheduler implements OnModuleInit {
  constructor(@InjectQueue('loyalty-jobs') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'birthday-bonus-scan',
      { every: DAY },
      { name: 'birthday-bonus' },
    );
    await this.queue.upsertJobScheduler(
      'point-expiry-scan',
      { every: DAY },
      { name: 'point-expiry' },
    );
  }
}
