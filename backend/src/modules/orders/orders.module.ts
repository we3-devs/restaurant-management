import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonsModule } from '../addons/addons.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { FoodVariantsModule } from '../food-variants/food-variants.module';
import { FoodsModule } from '../foods/foods.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { OutletDepartmentsModule } from '../outlet-departments/outlet-departments.module';
import { OutletsModule } from '../outlets/outlets.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { UnitsModule } from '../units/units.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { OrderItemIngredientReservation } from './entities/order-item-ingredient-reservation.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderTable } from './entities/order-table.entity';
import { Order } from './entities/order.entity';
import { OrderItemsController } from './order-items.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderItemAddon,
      OrderTable,
      OrderStatusHistory,
      OrderItemIngredientReservation,
      // OrderPayment "belongs" to OrderPaymentsModule, but OrdersService needs
      // direct read access to sum payments for recalculatePayments() —
      // registering the same entity's repository here avoids a circular
      // module import (OrderPaymentsModule already imports OrdersModule).
      OrderPayment,
    ]),
    OutletsModule,
    TableSessionsModule,
    DiningTablesModule,
    FoodsModule,
    FoodVariantsModule,
    AddonsModule,
    OutletDepartmentsModule,
    IngredientsModule,
    UnitsModule,
    InventoryStockModule,
    WarehousesModule,
  ],
  controllers: [OrdersController, OrderItemsController],
  providers: [OrdersService],
  exports: [TypeOrmModule, OrdersService],
})
export class OrdersModule {}
