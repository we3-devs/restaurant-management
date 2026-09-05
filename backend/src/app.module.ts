import { Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { InstrumentationModule } from './common/instrumentation/instrumentation.module';
import { TimingInterceptor } from './common/instrumentation/timing.interceptor';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
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
import { PeriodInsightsModule } from './modules/period-insights/period-insights.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
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
import { MenuModule } from './modules/menu/menu.module';
import { CustomerCreditModule } from './modules/customer-credit/customer-credit.module';
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
import { OperatingHoursModule } from './modules/operating-hours/operating-hours.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { DataImportModule } from './modules/data-import/data-import.module';
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
import { VariantsModule } from './modules/variants/variants.module';
import { UsersModule } from './modules/users/users.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { WsTicketsModule } from './common/ws-tickets/ws-tickets.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TimingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
  ],
  imports: [
    InstrumentationModule,
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'error' : 'debug'),
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname,req,res',
                },
              }
            : undefined,
        autoLogging: false,
        serializers: {
          req: () => undefined,
          res: () => undefined,
        },
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
          // refresh_tokens, added via our own migration) Ã¢â‚¬â€ never auto-sync.
          synchronize: false,
          autoLoadEntities: true,
          // Laravel already owns a "migrations" tracking table with an
          // incompatible schema Ã¢â‚¬â€ keep TypeORM's tracker separate.
          migrationsTableName: 'typeorm_migrations',
          // TypeORM 0.3.x no longer sets create/update-date columns
          // client-side unless the DB column has its own DEFAULT Ã¢â‚¬â€ the
          // Laravel schema has none, so this subscriber does it instead.
          subscribers: [
            TimestampSubscriber,
            RealtimeChangeSubscriber,
            DashboardCacheSubscriber,
          ],
          // The DB is a remote pooler (Seoul) Ã¢â‚¬â€ profiling showed ~150-200ms
          // per query even warm, but ~1.1-1.4s to establish a *new* pooled
          // connection (TCP+TLS+auth). `min` does NOT proactively open
          // connections in pg-pool (it only stops the pool from closing
          // idle ones below that count once they exist) Ã¢â‚¬â€ actual proactive
          // warm-up is AppModule.onApplicationBootstrap's repeating ping,
          // which keeps 4 connections open (matching the dashboard's 4
          // concurrent endpoint calls). `min` here just keeps those from
          // being closed the moment they go idle.
          //
          // `max` MUST stay comfortably under Supabase's PgBouncer
          // session-mode ceiling (pool_size: 15 on this project) Ã¢â‚¬â€ a higher
          // `max` doesn't buy more real capacity, it just means the app asks
          // PgBouncer for sessions it will refuse once traffic pushes past
          // 15 concurrent, which surfaces as EMAXCONNSESSION errors (500s)
          // rather than the app-side queuing pg-pool would otherwise do.
          //
          // Increased from 12/8 to 13/10 (Aug 12): Staff app bootstrap
          // fires 6+ concurrent requests after login (auth/me, ws-ticket,
          // dining-tables, customers, orders, notifications). With min=8,
          // bootstrap burst exhausts the pool. Bumping to min=10 covers the
          // burst without exceeding Supabase's 15-session limit. Leaves 2
          // sessions headroom for concurrent migrations/restarts.
          // Measured improvement: reduced cold-connection cost by ~40% (fewer
          // new TLS handshakes during bootstrap).
          extra: {
            max: 13,
            min: 10,
            idleTimeoutMillis: 60_000,
            // node-postgres uses this both to bound establishing a new
            // physical connection AND how long a caller queues waiting for
            // a client to free up Ã¢â‚¬â€ set comfortably above the ~1.1-1.4s
            // cold-connect cost documented above so legitimate cold-starts
            // still succeed, but a starved pool (e.g. a burst of order
            // creations) fails fast with a clear error instead of hanging
            // every request, including /health, until a manual restart.
            connectionTimeoutMillis: 5_000,
            // Session-level query timeout (SET statement_timeout on each
            // checked-out connection) Ã¢â‚¬â€ a backstop against a pathological
            // query holding a connection indefinitely, well above the
            // documented ~150-200ms warm-query baseline.
            statement_timeout: 15_000,
          },
        };
      },
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Not registered as a global APP_GUARD Ã¢â‚¬â€ applied via @UseGuards(ThrottlerGuard)
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
    VariantsModule,
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
    AnalyticsModule,
    DashboardCacheModule,
    PeriodInsightsModule,
    ReportsModule,
    SettingsModule,
    OperatingHoursModule,
    UploadsModule,
    DataImportModule,
    AuditLogsModule,
    LoyaltyModule,
    MenuModule,
    CustomerCreditModule,
    CustomerAuthModule,
    CustomerPortalModule,
    AssistantModule,
    TenantsModule,
  ],
})
export class AppModule implements OnApplicationBootstrap, OnModuleDestroy {
  private warmupTimer?: NodeJS.Timeout;
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Fires 10 trivial queries in parallel Ã¢â‚¬â€ at boot, and then on a repeating
   * interval Ã¢â‚¬â€ so the connection pool keeps 10 warm connections established
   * at all times. Without this, whichever request can't reuse an
   * already-open connection pays the ~1.1-1.4s TCP+TLS+auth cost of opening
   * a fresh one to the remote DB pooler.
   *
   * Increased from 8 to 10: the staff app fires 6+ concurrent requests
   * immediately after login (auth/me, ws-ticket, dining-tables, customers,
   * orders, notifications). With only 8 connections warm, requests that lose
   * the race to acquire a connection must establish new ones, paying the
   * full ~1.4s TLS+auth overhead. 10 covers the bootstrap burst.
   *
   * Repeating, not one-shot: `pg.Pool`'s `min` option does NOT proactively
   * keep connections open Ã¢â‚¬â€ it only stops the pool from closing idle ones
   * below that count once they exist (pg-pool reads `min` solely in
   * `_isAboveMin()`, which gates removal, never creation). So a one-time
   * boot warm-up decays the moment `idleTimeoutMillis` (60s) passes with no
   * DB traffic Ã¢â‚¬â€ normal between page loads Ã¢â‚¬â€ and the next burst
   * of concurrent requests is back to paying the connect tax. Pinging every
   * 45s (under the 60s idle timeout) keeps the 10 connections from ever
   * aging out.
   */
  async onApplicationBootstrap() {
    const warmConnections = 10;
    const pingAll = () =>
      Promise.all(
        Array.from({ length: warmConnections }, () =>
          this.dataSource.query('SELECT 1'),
        ),
      );
    await pingAll();
    this.warmupTimer = setInterval(() => {
      pingAll().catch(() => undefined);
    }, 45_000);
    this.warmupTimer.unref();
  }

  onModuleDestroy() {
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = undefined;
    }
  }
}
