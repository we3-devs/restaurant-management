import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(@InjectQueue('demo') private readonly demoQueue: Queue) {}

  @Public()
  @Post('ping')
  @ApiOperation({
    summary:
      'Enqueues a ping job to prove the Redis/BullMQ wiring works end to end',
  })
  async ping() {
    const job = await this.demoQueue.add('ping', {
      sentAt: new Date().toISOString(),
    });
    return { queued: true, jobId: job.id };
  }
}
