import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientStockTransferItem } from './entities/ingredient-stock-transfer-item.entity';
import { IngredientStockTransfer } from './entities/ingredient-stock-transfer.entity';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngredientStockTransfer,
      IngredientStockTransferItem,
    ]),
    AuthModule,
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [TypeOrmModule, StockTransfersService],
})
export class StockTransfersModule {}
