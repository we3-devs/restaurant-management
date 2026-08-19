import { Module } from '@nestjs/common';
import { AddonsModule } from '../addons/addons.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { FoodCategoriesModule } from '../food-categories/food-categories.module';
import { IngredientCategoriesModule } from '../ingredient-categories/ingredient-categories.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { OutletDepartmentsModule } from '../outlet-departments/outlet-departments.module';
import { OutletsModule } from '../outlets/outlets.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { UnitsModule } from '../units/units.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [
    AuthModule,
    OutletsModule,
    OutletDepartmentsModule,
    DiningTablesModule,
    FoodCategoriesModule,
    AddonsModule,
    CustomersModule,
    ReservationsModule,
    IngredientsModule,
    UnitsModule,
    IngredientCategoriesModule,
    WarehousesModule,
  ],
  controllers: [BootstrapController],
  providers: [BootstrapService],
})
export class BootstrapModule {}
