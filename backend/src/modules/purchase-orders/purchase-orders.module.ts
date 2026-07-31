import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderItem]), NotificationsModule, KitchenTicketsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [TypeOrmModule, PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
