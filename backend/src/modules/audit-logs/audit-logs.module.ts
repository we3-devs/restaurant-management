import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditCleanupScheduler } from './jobs/audit-cleanup.scheduler';
import { AuditCleanupProcessor } from './processors/audit-cleanup.processor';
import { AuditLogWriteProcessor } from './processors/audit-log-write.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue(
      { name: 'audit-log-write' },
      { name: 'audit-cleanup' },
    ),
  ],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    AuditInterceptor,
    AuditLogWriteProcessor,
    AuditCleanupProcessor,
    AuditCleanupScheduler,
  ],
  exports: [AuditLogsService, AuditInterceptor],
})
export class AuditLogsModule {}
