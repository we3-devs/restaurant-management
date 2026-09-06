import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { FoodsModule } from '../foods/foods.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Order, OrderItem, OrderPayment]),
    PassportModule,
    // Registers the 'jwt-customer' passport strategy this controller's guard
    // depends on.
    CustomerAuthModule,
    FoodsModule,
    LoyaltyModule,
    AuditLogsModule,
  ],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
})
export class CustomerPortalModule {}
