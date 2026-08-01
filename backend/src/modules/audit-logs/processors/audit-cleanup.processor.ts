import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AuditLogsService } from '../audit-logs.service';

// Fixed 90-day retention default — reading this from SettingsService would
// create a circular dependency between AuditLogsModule and SettingsModule.
const RETENTION_DAYS = 90;

@Processor('audit-cleanup')
export class AuditCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditCleanupProcessor.name);

  constructor(private readonly auditLogsService: AuditLogsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'cleanup') return;
    const { deleted } = await this.auditLogsService.purgeOlderThan(
      RETENTION_DAYS,
    );
    if (deleted) this.logger.log(`Purged ${deleted} audit log row(s)`);
  }
}
