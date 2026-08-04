import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IngredientInventoryTransaction } from './entities/ingredient-inventory-transaction.entity';
import { WarehouseIngredientStock } from './entities/warehouse-ingredient-stock.entity';
import { InventoryAlertsProcessor } from './inventory-alerts.processor';
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
    NotificationsModule,
    // Circular: KitchenTicketsModule imports OrdersModule, which imports
    // InventoryStockModule — without forwardRef this chain can resolve to
    // `undefined` mid-cycle at module-load time.
    forwardRef(() => KitchenTicketsModule),
  ],
  controllers: [
    WarehouseIngredientStocksController,
    InventoryTransactionsController,
  ],
  providers: [WarehouseIngredientStocksService, InventoryAlertsProcessor],
  exports: [TypeOrmModule, WarehouseIngredientStocksService],
})
export class InventoryStockModule {}
