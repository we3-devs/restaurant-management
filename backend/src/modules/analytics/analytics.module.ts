import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { Order } from '../orders/entities/order.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsDailySnapshot } from './entities/analytics-daily-snapshot.entity';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [AuthModule, SettingsModule, ReportsModule, TypeOrmModule.forFeature([Order, AnalyticsDailySnapshot])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
