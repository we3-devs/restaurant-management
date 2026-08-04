import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AuditLogsService } from '../audit-logs.service';

const DAY = 24 * 60 * 60_000;

// Fixed 90-day retention default — reading this from SettingsService would
// create a circular dependency between AuditLogsModule and SettingsModule.
const RETENTION_DAYS = 90;

/** Daily audit-log retention sweep — replaces the old `audit-cleanup` BullMQ queue. */
@Injectable()
export class AuditCleanupScheduler {
  private readonly logger = new Logger(AuditCleanupScheduler.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Interval(DAY)
  async cleanup(): Promise<void> {
    try {
      const { deleted } = await this.auditLogsService.purgeOlderThan(RETENTION_DAYS);
      if (deleted) this.logger.log(`Purged ${deleted} audit log row(s)`);
    } catch (err) {
      this.logger.error(`Audit cleanup failed: ${(err as Error).message}`);
    }
  }
}
