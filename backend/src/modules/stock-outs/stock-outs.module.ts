import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockOutItem } from './entities/ingredient-stock-out-item.entity';
import { IngredientStockOut } from './entities/ingredient-stock-out.entity';
import { StockOutsController } from './stock-outs.controller';
import { StockOutsService } from './stock-outs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientStockOut, IngredientStockOutItem]),
    AuthModule,
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [StockOutsController],
  providers: [StockOutsService],
  exports: [TypeOrmModule, StockOutsService],
})
export class StockOutsModule {}
