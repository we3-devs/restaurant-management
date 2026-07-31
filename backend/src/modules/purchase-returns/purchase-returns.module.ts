import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PurchaseReturnItem } from './entities/purchase-return-item.entity';
import { PurchaseReturn } from './entities/purchase-return.entity';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseReturn, PurchaseReturnItem]),
    InventoryStockModule,
    NotificationsModule,
    KitchenTicketsModule,
    SuppliersModule,
  ],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService],
  exports: [TypeOrmModule, PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
