import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardCacheModule } from '../dashboard-cache/dashboard-cache.module';
import { OutletsModule } from '../outlets/outlets.module';
import { PeriodInsightNp } from './entities/period-insight-np.entity';
import { PeriodInsight } from './entities/period-insight.entity';
import { PeriodInsightsNpService } from './period-insights-np.service';
import { PeriodInsightsComputeService } from './period-insights-compute.service';
import { PeriodInsightsController } from './period-insights.controller';
import { PeriodInsightsScheduler } from './period-insights.scheduler';
import { PeriodInsightsService } from './period-insights.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PeriodInsight, PeriodInsightNp]),
    DashboardCacheModule,
    OutletsModule,
  ],
  controllers: [PeriodInsightsController],
  providers: [
    PeriodInsightsComputeService,
    PeriodInsightsService,
    PeriodInsightsNpService,
    PeriodInsightsScheduler,
  ],
  exports: [PeriodInsightsService, PeriodInsightsNpService],
})
export class PeriodInsightsModule {}
