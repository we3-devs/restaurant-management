import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { UnitsModule } from '../units/units.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockInItem } from './entities/ingredient-stock-in-item.entity';
import { IngredientStockIn } from './entities/ingredient-stock-in.entity';
import { StockInsController } from './stock-ins.controller';
import { StockInsService } from './stock-ins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientStockIn, IngredientStockInItem]),
    AuthModule,
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
    UnitsModule,
  ],
  controllers: [StockInsController],
  providers: [StockInsService],
  exports: [TypeOrmModule, StockInsService],
})
export class StockInsModule {}
