import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuditLogsService, RecordAuditInput } from '../audit-logs.service';

@Processor('audit-log-write')
export class AuditLogWriteProcessor extends WorkerHost {
  constructor(private readonly auditLogsService: AuditLogsService) {
    super();
  }

  async process(job: Job<RecordAuditInput>): Promise<void> {
    await this.auditLogsService.record(job.data);
  }
}
