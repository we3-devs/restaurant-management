import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('demo')
export class DemoProcessor extends WorkerHost {
  private readonly logger = new Logger(DemoProcessor.name);

  process(job: Job<{ sentAt: string }>): Promise<{ pong: true }> {
    this.logger.log(`pong (job ${job.id}, sent at ${job.data.sentAt})`);
    return Promise.resolve({ pong: true });
  }
}
