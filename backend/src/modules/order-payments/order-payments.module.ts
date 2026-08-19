import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CustomerCreditModule } from '../customer-credit/customer-credit.module';
import { CustomersModule } from '../customers/customers.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderPaymentsController } from './order-payments.controller';
import { OrderPaymentsService } from './order-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderPayment]),
    AuthModule,
    OrdersModule,
    TableSessionsModule,
    NotificationsModule,
    KitchenTicketsModule,
    CustomersModule,
    CustomerCreditModule,
    SettingsModule,
  ],
  controllers: [OrderPaymentsController],
  providers: [OrderPaymentsService],
  exports: [TypeOrmModule, OrderPaymentsService],
})
export class OrderPaymentsModule {}
