import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { SettingsModule } from '../settings/settings.module';
import { LoyaltyAccount } from './entities/loyalty-account.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { LoyaltyJobsScheduler } from './jobs/loyalty-jobs.scheduler';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoyaltyAccount, LoyaltyTransaction]),
    SettingsModule,
    NotificationsModule,
    OutletsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which imports
    // LoyaltyModule — without forwardRef this chain can resolve to
    // `undefined` mid-cycle at module-load time.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyJobsScheduler],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
