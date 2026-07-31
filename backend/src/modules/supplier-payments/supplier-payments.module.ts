import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { SupplierPayment } from './entities/supplier-payment.entity';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { SupplierPaymentsService } from './supplier-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupplierPayment]),
    NotificationsModule,
    KitchenTicketsModule,
    SuppliersModule,
  ],
  controllers: [SupplierPaymentsController],
  providers: [SupplierPaymentsService],
  exports: [TypeOrmModule, SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
