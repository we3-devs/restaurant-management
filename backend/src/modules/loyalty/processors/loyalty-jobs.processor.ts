import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LoyaltyService } from '../loyalty.service';

@Processor('loyalty-jobs')
export class LoyaltyJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(LoyaltyJobsProcessor.name);

  constructor(private readonly loyaltyService: LoyaltyService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'birthday-bonus': {
        const { granted } = await this.loyaltyService.grantBirthdayBonuses();
        if (granted) this.logger.log(`Granted birthday bonus to ${granted} customer(s)`);
        return;
      }
      case 'point-expiry': {
        const { processed } = await this.loyaltyService.expirePoints();
        if (processed) this.logger.log(`Processed point expiry for ${processed} account(s)`);
        return;
      }
      default:
        this.logger.warn(`Unknown loyalty-jobs job: ${job.name}`);
    }
  }
}
