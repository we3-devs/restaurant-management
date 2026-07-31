import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderPaymentsController } from './order-payments.controller';
import { OrderPaymentsService } from './order-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderPayment]),
    OrdersModule,
    NotificationsModule,
    KitchenTicketsModule,
  ],
  controllers: [OrderPaymentsController],
  providers: [OrderPaymentsService],
  exports: [TypeOrmModule, OrderPaymentsService],
})
export class OrderPaymentsModule {}
