import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomersModule } from '../customers/customers.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/entities/order.entity';
import { OutletsModule } from '../outlets/outlets.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { SettingsModule } from '../settings/settings.module';
import { TableSession } from './entities/table-session.entity';
import { TableSessionCustomer } from './entities/table-session-customer.entity';
import { GuestQuickOrderSessionsController } from './guest-quick-order-sessions.controller';
import { GuestTableScanController } from './guest-table-scan.controller';
import { GuestTableSessionsController } from './guest-table-sessions.controller';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [
    // Order is registered here (not via OrdersModule, which itself imports
    // this module) so TableSessionsService can cancel abandoned empty
    // orders on session end without a circular service dependency.
    TypeOrmModule.forFeature([TableSession, TableSessionCustomer, LoyaltyAccount, Order]),
    AuthModule,
    DiningTablesModule,
    OutletsModule,
    CustomersModule,
    CustomerAuthModule,
    forwardRef(() => ReservationsModule),
    NotificationsModule,
    SettingsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which imports
    // TableSessionsModule — without forwardRef this chain can resolve to
    // `undefined` mid-cycle at module-load time.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [
    TableSessionsController,
    GuestTableScanController,
    GuestTableSessionsController,
    GuestQuickOrderSessionsController,
  ],
  providers: [TableSessionsService],
  exports: [TypeOrmModule, TableSessionsService],
})
export class TableSessionsModule {}
