import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { KitchenTicketsService } from './kitchen-tickets.service';

const SCAN_INTERVAL_MS = 10 * 60_000;
const DELAY_THRESHOLD_MINUTES = 15;

@Processor('kitchen-delay-alerts')
export class KitchenDelayScanProcessor extends WorkerHost {
  private readonly logger = new Logger(KitchenDelayScanProcessor.name);

  constructor(private readonly kitchenTicketsService: KitchenTicketsService) {
    super();
  }

  async process(job: Job): Promise<{ notified: number }> {
    this.logger.debug(`Running kitchen delay scan (job ${job.id})`);
    const notified = await this.kitchenTicketsService.scanForDelayedTickets(
      DELAY_THRESHOLD_MINUTES,
    );
    if (notified > 0) {
      this.logger.log(`Kitchen delay scan flagged ${notified} ticket(s)`);
    }
    return { notified };
  }
}

/** Registers the repeatable scan job once on boot — see demo.module.ts for the base BullMQ wiring pattern this follows. */
@Injectable()
export class KitchenDelayScanScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('kitchen-delay-alerts') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'kitchen-delay-scan',
      { every: SCAN_INTERVAL_MS },
      { name: 'scan' },
    );
  }
}
