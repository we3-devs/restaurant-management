import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { TableSession } from './entities/table-session.entity';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TableSession, LoyaltyAccount]),
    DiningTablesModule,
    OutletsModule,
    CustomersModule,
    forwardRef(() => ReservationsModule),
    NotificationsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which imports
    // TableSessionsModule — without forwardRef this chain can resolve to
    // `undefined` mid-cycle at module-load time.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [TableSessionsController],
  providers: [TableSessionsService],
  exports: [TypeOrmModule, TableSessionsService],
})
export class TableSessionsModule {}
