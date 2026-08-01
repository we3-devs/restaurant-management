import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { RealtimeChangeSubscriber } from './common/subscribers/realtime-change.subscriber';
import { TimestampSubscriber } from './common/subscribers/timestamp.subscriber';
import configuration, { AppConfig } from './config/configuration';
import { validate } from './config/env.validation';
import { AddonGroupsModule } from './modules/addon-groups/addon-groups.module';
import { AddonsModule } from './modules/addons/addons.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { BusinessOperationsModule } from './modules/business-operations/business-operations.module';
import { CustomerAuthModule } from './modules/customer-auth/customer-auth.module';
import { CustomerPortalModule } from './modules/customer-portal/customer-portal.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { GoodsReceivingModule } from './modules/goods-receiving/goods-receiving.module';
import { DemoModule } from './modules/demo/demo.module';
import { DiningAreasModule } from './modules/dining-areas/dining-areas.module';
import { DiningTablesModule } from './modules/dining-tables/dining-tables.module';
import { FoodCategoriesModule } from './modules/food-categories/food-categories.module';
import { FoodVariantsModule } from './modules/food-variants/food-variants.module';
import { FoodsModule } from './modules/foods/foods.module';
import { HealthModule } from './modules/health/health.module';
import { IngredientCategoriesModule } from './modules/ingredient-categories/ingredient-categories.module';
import { IngredientWastagesModule } from './modules/ingredient-wastages/ingredient-wastages.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { InventoryStockModule } from './modules/inventory-stock/inventory-stock.module';
import { KitchenTicketsModule } from './modules/kitchen-tickets/kitchen-tickets.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrderPaymentsModule } from './modules/order-payments/order-payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { OutletDepartmentsModule } from './modules/outlet-departments/outlet-departments.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { PurchaseReturnsModule } from './modules/purchase-returns/purchase-returns.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RolesModule } from './modules/roles/roles.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { StockAdjustmentsModule } from './modules/stock-adjustments/stock-adjustments.module';
import { StockCountsModule } from './modules/stock-counts/stock-counts.module';
import { StockInsModule } from './modules/stock-ins/stock-ins.module';
import { StockOutsModule } from './modules/stock-outs/stock-outs.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';
import { SupplierPaymentsModule } from './modules/supplier-payments/supplier-payments.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TableSessionsModule } from './modules/table-sessions/table-sessions.module';
import { UnitsModule } from './modules/units/units.module';
import { UsersModule } from './modules/users/users.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        autoLogging: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const dbConfig = configService.get('database', { infer: true })!;
        return {
          type: 'postgres' as const,
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
          password: dbConfig.password,
          // Schema is owned by the existing Laravel migrations (except
          // refresh_tokens, added via our own migration) — never auto-sync.
          synchronize: false,
          autoLoadEntities: true,
          // Laravel already owns a "migrations" tracking table with an
          // incompatible schema — keep TypeORM's tracker separate.
          migrationsTableName: 'typeorm_migrations',
          // TypeORM 0.3.x no longer sets create/update-date columns
          // client-side unless the DB column has its own DEFAULT — the
          // Laravel schema has none, so this subscriber does it instead.
          subscribers: [TimestampSubscriber, RealtimeChangeSubscriber],
        };
      },
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule,
    QueueModule,
    UsersModule,
    RolesModule,
    OutletsModule,
    OutletDepartmentsModule,
    WarehousesModule,
    FoodCategoriesModule,
    AddonGroupsModule,
    FoodsModule,
    FoodVariantsModule,
    AddonsModule,
    DiningAreasModule,
    DiningTablesModule,
    CustomersModule,
    ReservationsModule,
    TableSessionsModule,
    OrdersModule,
    OrderPaymentsModule,
    KitchenTicketsModule,
    NotificationsModule,
    ServiceRequestsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    GoodsReceivingModule,
    PurchaseReturnsModule,
    SupplierPaymentsModule,
    EmployeesModule,
    ShiftsModule,
    AttendanceModule,
    AssignmentsModule,
    BusinessOperationsModule,
    UnitsModule,
    IngredientCategoriesModule,
    IngredientsModule,
    InventoryStockModule,
    StockInsModule,
    StockOutsModule,
    StockTransfersModule,
    IngredientWastagesModule,
    StockAdjustmentsModule,
    StockCountsModule,
    AuthModule,
    HealthModule,
    DemoModule,
    BootstrapModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
    AuditLogsModule,
    LoyaltyModule,
    CustomerAuthModule,
    CustomerPortalModule,
  ],
})
export class AppModule {}
