import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DashboardCacheSection } from './dashboard-cache-bridge';
import { DashboardCacheService } from './dashboard-cache.service';

interface InvalidateJobData {
  outletId: number | null;
  sections: DashboardCacheSection[];
}

/** Handles the two dashboard-cache job types: targeted per-outlet section rebuilds (enqueued by DashboardCacheSubscriber on writes) and the nightly full rebuild (see DashboardCacheScheduler). */
@Processor('dashboard-cache-jobs')
export class DashboardCacheProcessor extends WorkerHost {
  private readonly logger = new Logger(DashboardCacheProcessor.name);

  constructor(private readonly cacheService: DashboardCacheService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'invalidate': {
        const { outletId, sections } = job.data as InvalidateJobData;
        await this.cacheService.rebuildSections(outletId, sections);
        return;
      }
      case 'rebuild-all':
        await this.cacheService.rebuildAll();
        return;
      default:
        this.logger.warn(`Unknown dashboard-cache job: ${job.name}`);
    }
  }
}
