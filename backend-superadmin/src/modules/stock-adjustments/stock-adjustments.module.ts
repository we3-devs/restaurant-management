import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockAdjustmentItem } from './entities/ingredient-stock-adjustment-item.entity';
import { IngredientStockAdjustment } from './entities/ingredient-stock-adjustment.entity';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngredientStockAdjustment,
      IngredientStockAdjustmentItem,
    ]),
    AuthModule,
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
    NotificationsModule,
    KitchenTicketsModule,
  ],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [TypeOrmModule, StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
