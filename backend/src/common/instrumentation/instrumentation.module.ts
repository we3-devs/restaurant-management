import { Module } from '@nestjs/common';
import { PoolMetrics } from './pool-metrics';

@Module({
  providers: [PoolMetrics],
  exports: [PoolMetrics],
})
export class InstrumentationModule {}
