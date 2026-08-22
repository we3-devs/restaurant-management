import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardCacheModule } from '../dashboard-cache/dashboard-cache.module';
import { Order } from '../orders/entities/order.entity';
import { OutletsModule } from '../outlets/outlets.module';
import { PeriodInsightNp } from './entities/period-insight-np.entity';
import { PeriodInsight } from './entities/period-insight.entity';
import { PeriodInsightsBackfillService } from './period-insights-backfill.service';
import { PeriodInsightsNpService } from './period-insights-np.service';
import { PeriodInsightsComputeService } from './period-insights-compute.service';
import { PeriodInsightsController } from './period-insights.controller';
import { PeriodInsightsScheduler } from './period-insights.scheduler';
import { PeriodInsightsService } from './period-insights.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PeriodInsight, PeriodInsightNp, Order]),
    DashboardCacheModule,
    OutletsModule,
  ],
  controllers: [PeriodInsightsController],
  providers: [
    PeriodInsightsComputeService,
    PeriodInsightsService,
    PeriodInsightsNpService,
    PeriodInsightsBackfillService,
    PeriodInsightsScheduler,
  ],
  exports: [PeriodInsightsService, PeriodInsightsNpService],
})
export class PeriodInsightsModule {}
