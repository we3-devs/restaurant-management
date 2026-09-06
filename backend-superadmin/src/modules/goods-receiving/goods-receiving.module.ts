import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { GoodsReceivingItem } from './entities/goods-receiving-item.entity';
import { GoodsReceiving } from './entities/goods-receiving.entity';
import { GoodsReceivingController } from './goods-receiving.controller';
import { GoodsReceivingService } from './goods-receiving.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoodsReceiving, GoodsReceivingItem]),
    AuthModule,
    PurchaseOrdersModule,
    InventoryStockModule,
    IngredientsModule,
    NotificationsModule,
    KitchenTicketsModule,
    SuppliersModule,
  ],
  controllers: [GoodsReceivingController],
  providers: [GoodsReceivingService],
  exports: [TypeOrmModule, GoodsReceivingService],
})
export class GoodsReceivingModule {}
