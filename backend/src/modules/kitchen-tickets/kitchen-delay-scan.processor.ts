import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { KitchenTicketsService } from './kitchen-tickets.service';

// Short enough that an alert lands within a minute of the tenant's
// configured threshold (Settings > Notifications), not up to 10 late.
const SCAN_INTERVAL_MS = 60_000;

/** Kitchen ticket delay sweep — replaces the old `kitchen-delay-alerts` BullMQ queue. */
@Injectable()
export class KitchenDelayScanProcessor {
  private readonly logger = new Logger(KitchenDelayScanProcessor.name);

  constructor(private readonly kitchenTicketsService: KitchenTicketsService) {}

  @Interval(SCAN_INTERVAL_MS)
  async scan(): Promise<{ notified: number }> {
    this.logger.debug('Running kitchen delay scan');
    try {
      const notified = await this.kitchenTicketsService.scanForDelayedTickets();
      if (notified > 0) {
        this.logger.log(`Kitchen delay scan flagged ${notified} ticket(s)`);
      }
      return { notified };
    } catch (err) {
      this.logger.error(`Kitchen delay scan failed: ${(err as Error).message}`);
      return { notified: 0 };
    }
  }
}
