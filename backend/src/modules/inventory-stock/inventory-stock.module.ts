import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientInventoryTransaction } from './entities/ingredient-inventory-transaction.entity';
import { WarehouseIngredientStock } from './entities/warehouse-ingredient-stock.entity';
import {
  InventoryTransactionsController,
  WarehouseIngredientStocksController,
} from './warehouse-ingredient-stocks.controller';
import { WarehouseIngredientStocksService } from './warehouse-ingredient-stocks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseIngredientStock,
      IngredientInventoryTransaction,
    ]),
  ],
  controllers: [
    WarehouseIngredientStocksController,
    InventoryTransactionsController,
  ],
  providers: [WarehouseIngredientStocksService],
  exports: [TypeOrmModule, WarehouseIngredientStocksService],
})
export class InventoryStockModule {}
