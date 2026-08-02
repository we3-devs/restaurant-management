import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { SettingsModule } from '../settings/settings.module';
import { LoyaltyAccount } from './entities/loyalty-account.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { LoyaltyJobsProcessor } from './processors/loyalty-jobs.processor';
import { LoyaltyJobsScheduler } from './jobs/loyalty-jobs.scheduler';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoyaltyAccount, LoyaltyTransaction]),
    BullModule.registerQueue({ name: 'loyalty-jobs' }),
    SettingsModule,
    NotificationsModule,
    OutletsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which imports
    // LoyaltyModule — without forwardRef this chain can resolve to
    // `undefined` mid-cycle at module-load time.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyJobsScheduler, LoyaltyJobsProcessor],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
