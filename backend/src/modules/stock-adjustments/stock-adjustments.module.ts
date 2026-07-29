import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
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
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [TypeOrmModule, StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
