import { CacheModule } from '@nestjs/cache-manager';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { DashboardCacheSubscriber } from './common/subscribers/dashboard-cache.subscriber';
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
import { DashboardCacheModule } from './modules/dashboard-cache/dashboard-cache.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { GoodsReceivingModule } from './modules/goods-receiving/goods-receiving.module';
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
import { WsTicketsModule } from './common/ws-tickets/ws-tickets.module';

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
          subscribers: [
            TimestampSubscriber,
            RealtimeChangeSubscriber,
            DashboardCacheSubscriber,
          ],
          // The DB is a remote pooler (Seoul) — profiling showed ~150-200ms
          // per query even warm, but ~1.1-1.4s to establish a *new* pooled
          // connection (TCP+TLS+auth). `min` does NOT proactively open
          // connections in pg-pool (it only stops the pool from closing
          // idle ones below that count once they exist) — actual proactive
          // warm-up is AppModule.onApplicationBootstrap's repeating ping,
          // which keeps 4 connections open (matching the dashboard's 4
          // concurrent endpoint calls). `min` here just keeps those from
          // being closed the moment they go idle.
          //
          // `max` MUST stay comfortably under Supabase's PgBouncer
          // session-mode ceiling (pool_size: 15 on this project) — a higher
          // `max` doesn't buy more real capacity, it just means the app asks
          // PgBouncer for sessions it will refuse once traffic pushes past
          // 15 concurrent, which surfaces as EMAXCONNSESSION errors (500s)
          // rather than the app-side queuing pg-pool would otherwise do.
          //
          // Raised from 10/4 to 12/8: the dashboard shell fires more than
          // just the 4 dashboard-widget endpoints concurrently on every page
          // load — ws-ticket, notifications, outlets(/assigned),
          // outlet-departments/assigned and the orders/dining-tables
          // background prefetch all race the same instant the active outlet
          // resolves (see AppModule.onApplicationBootstrap below). With only
          // 4 warm connections, the requests that lost that race each paid
          // the full ~1.1-1.4s cold-connect cost (measured: ws-ticket
          // 1.24s, notifications 1.02s), even though their own queries only
          // take ~150-200ms once connected. 12 leaves 3 sessions of
          // headroom for restart overlap, a concurrent seed/migration run,
          // or Supabase's own overhead.
          extra: {
            max: 12,
            min: 8,
            idleTimeoutMillis: 60_000,
          },
        };
      },
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Not registered as a global APP_GUARD — applied via @UseGuards(ThrottlerGuard)
    // only on the handful of public, unauthenticated guest-facing routes (see
    // customer-auth/dining-tables/orders/service-requests controllers), so
    // authenticated staff APIs are completely untouched by this.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    WsTicketsModule,
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
    BootstrapModule,
    DashboardModule,
    DashboardCacheModule,
    ReportsModule,
    SettingsModule,
    AuditLogsModule,
    LoyaltyModule,
    CustomerAuthModule,
    CustomerPortalModule,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Fires 8 trivial queries in parallel — at boot, and then on a repeating
   * interval — so the connection pool keeps 8 warm connections established
   * at all times. Without this, whichever request can't reuse an
   * already-open connection pays the ~1.1-1.4s TCP+TLS+auth cost of opening
   * a fresh one to the remote DB pooler.
   *
   * 8, not 4: the dashboard shell fires more than just the 4 dashboard-
   * widget endpoints (stats/charts/breakdown/inventory-activity) the moment
   * the active outlet resolves — it also kicks off ws-ticket, notifications,
   * outlet-departments/assigned, and an orders/dining-tables background
   * prefetch, all in the same tick. With only 4 connections warm, the
   * requests that lost that race (typically ws-ticket and notifications,
   * since they're gated behind the outlet fetch resolving first) paid the
   * full connect cost, which is exactly why they measured ~1.0-1.25s
   * despite their own queries taking ~150-300ms once actually connected.
   *
   * Repeating, not one-shot: `pg.Pool`'s `min` option does NOT proactively
   * keep connections open — it only stops the pool from closing idle ones
   * below that count once they exist (pg-pool reads `min` solely in
   * `_isAboveMin()`, which gates removal, never creation). So a one-time
   * boot warm-up decays the moment `idleTimeoutMillis` (60s) passes with no
   * DB traffic — normal between dashboard page loads — and the next burst
   * of concurrent requests is back to paying the connect tax. Pinging every
   * 45s (under the 60s idle timeout) keeps the 8 connections from ever
   * aging out.
   */
  async onApplicationBootstrap() {
    const warmConnections = 8;
    const pingAll = () =>
      Promise.all(
        Array.from({ length: warmConnections }, () =>
          this.dataSource.query('SELECT 1'),
        ),
      );
    await pingAll();
    setInterval(() => {
      pingAll().catch(() => undefined);
    }, 45_000).unref();
  }
}
