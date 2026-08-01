import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

const DAY = 24 * 60 * 60_000;

/** Registers the repeatable audit-log retention sweep once on boot (see BusinessOperationsScheduler for the base pattern). */
@Injectable()
export class AuditCleanupScheduler implements OnModuleInit {
  constructor(@InjectQueue('audit-cleanup') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'audit-cleanup-scan',
      { every: DAY },
      { name: 'cleanup' },
    );
  }
}
