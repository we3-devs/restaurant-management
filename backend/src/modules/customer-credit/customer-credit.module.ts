import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { CustomerCreditController } from './customer-credit.controller';
import { CustomerCreditService } from './customer-credit.service';
import { CustomerCreditAccount } from './entities/customer-credit-account.entity';
import { CustomerCreditTransaction } from './entities/customer-credit-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerCreditAccount, CustomerCreditTransaction]),
    NotificationsModule,
    OutletsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which (via
    // OrderPaymentsModule) imports CustomerCreditModule — without
    // forwardRef this chain can resolve to `undefined` mid-cycle at
    // module-load time. Mirrors LoyaltyModule's identical import.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [CustomerCreditController],
  providers: [CustomerCreditService],
  exports: [CustomerCreditService],
})
export class CustomerCreditModule {}
