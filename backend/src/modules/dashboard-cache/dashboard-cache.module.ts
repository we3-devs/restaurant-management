import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/entities/order.entity';
import { OutletsModule } from '../outlets/outlets.module';
import { DashboardCacheProcessor } from './dashboard-cache.processor';
import { DashboardCacheScheduler } from './dashboard-cache.scheduler';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardComputeService } from './dashboard-compute.service';
import { DashboardBreakdownCache } from './entities/dashboard-breakdown-cache.entity';
import { DashboardChartCache } from './entities/dashboard-chart-cache.entity';
import { DashboardInventoryCache } from './entities/dashboard-inventory-cache.entity';
import { DashboardStatsCache } from './entities/dashboard-stats-cache.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      KitchenTicket,
      DashboardStatsCache,
      DashboardChartCache,
      DashboardBreakdownCache,
      DashboardInventoryCache,
    ]),
    BullModule.registerQueue({ name: 'dashboard-cache-jobs' }),
    NotificationsModule,
    OutletsModule,
  ],
  providers: [
    DashboardComputeService,
    DashboardCacheService,
    DashboardCacheScheduler,
    DashboardCacheProcessor,
  ],
  exports: [DashboardCacheService, DashboardComputeService],
})
export class DashboardCacheModule {}
