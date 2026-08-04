import { Module } from '@nestjs/common';
import { DashboardCacheModule } from '../dashboard-cache/dashboard-cache.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DashboardCacheModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
