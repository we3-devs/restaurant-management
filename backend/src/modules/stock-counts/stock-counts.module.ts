import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockCountItem } from './entities/ingredient-stock-count-item.entity';
import { IngredientStockCount } from './entities/ingredient-stock-count.entity';
import { StockCountsController } from './stock-counts.controller';
import { StockCountsService } from './stock-counts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientStockCount, IngredientStockCountItem]),
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [StockCountsController],
  providers: [StockCountsService],
  exports: [TypeOrmModule, StockCountsService],
})
export class StockCountsModule {}
