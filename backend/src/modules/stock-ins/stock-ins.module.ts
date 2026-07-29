import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockInItem } from './entities/ingredient-stock-in-item.entity';
import { IngredientStockIn } from './entities/ingredient-stock-in.entity';
import { StockInsController } from './stock-ins.controller';
import { StockInsService } from './stock-ins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientStockIn, IngredientStockInItem]),
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [StockInsController],
  providers: [StockInsService],
  exports: [TypeOrmModule, StockInsService],
})
export class StockInsModule {}
