import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LoyaltyService } from '../loyalty.service';

const DAY = 24 * 60 * 60_000;

/** Daily loyalty background scans — replaces the old `loyalty-jobs` BullMQ queue. */
@Injectable()
export class LoyaltyJobsScheduler {
  private readonly logger = new Logger(LoyaltyJobsScheduler.name);

  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Interval(DAY)
  async runBirthdayBonusScan(): Promise<void> {
    try {
      const { granted } = await this.loyaltyService.grantBirthdayBonuses();
      if (granted) this.logger.log(`Granted birthday bonus to ${granted} customer(s)`);
    } catch (err) {
      this.logger.error(`Birthday bonus scan failed: ${(err as Error).message}`);
    }
  }

  @Interval(DAY)
  async runPointExpiryScan(): Promise<void> {
    try {
      const { processed } = await this.loyaltyService.expirePoints();
      if (processed) this.logger.log(`Processed point expiry for ${processed} account(s)`);
    } catch (err) {
      this.logger.error(`Point expiry scan failed: ${(err as Error).message}`);
    }
  }
}
