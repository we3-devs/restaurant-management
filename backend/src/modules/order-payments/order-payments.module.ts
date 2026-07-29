import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderPaymentsController } from './order-payments.controller';
import { OrderPaymentsService } from './order-payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderPayment]), OrdersModule],
  controllers: [OrderPaymentsController],
  providers: [OrderPaymentsService],
  exports: [TypeOrmModule, OrderPaymentsService],
})
export class OrderPaymentsModule {}
