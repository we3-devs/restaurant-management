import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoProcessor } from './demo.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'demo' })],
  controllers: [DemoController],
  providers: [DemoProcessor],
})
export class DemoModule {}
