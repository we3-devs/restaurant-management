import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { KitchenTicketsService } from './kitchen-tickets.service';

const SCAN_INTERVAL_MS = 10 * 60_000;
const DELAY_THRESHOLD_MINUTES = 15;

/** Kitchen ticket delay sweep — replaces the old `kitchen-delay-alerts` BullMQ queue. */
@Injectable()
export class KitchenDelayScanProcessor {
  private readonly logger = new Logger(KitchenDelayScanProcessor.name);

  constructor(private readonly kitchenTicketsService: KitchenTicketsService) {}

  @Interval(SCAN_INTERVAL_MS)
  async scan(): Promise<{ notified: number }> {
    this.logger.debug('Running kitchen delay scan');
    try {
      const notified = await this.kitchenTicketsService.scanForDelayedTickets(
        DELAY_THRESHOLD_MINUTES,
      );
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
