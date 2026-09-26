import { MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
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
import { DataImportModule } from './modules/data-import/data-import.module';
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
import { IngredientVariantsModule } from './modules/ingredient-variants/ingredient-variants.module';
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
import { PermissionsModule } from './modules/permissions/permissions.module';
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
import { TenantContext } from './common/tenant/tenant-context';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantRlsMiddleware } from './common/tenant/tenant-rls.middleware';
import { AssetsModule } from './modules/assets/assets.module';

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
    TenantModule,
    AssetsModule,
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
          extra: {
            max: 13,
            min: 10,
            idleTimeoutMillis: 60_000,
            connectionTimeoutMillis: 5_000,
            statement_timeout: 15_000,
          },
        };
      },
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 20 }]),
    WsTicketsModule,
    UsersModule,
    PermissionsModule,
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
    IngredientVariantsModule,
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
    DataImportModule,
    DashboardCacheModule,
    PeriodInsightsModule,
    ReportsModule,
    SettingsModule,
    OperatingHoursModule,
    UploadsModule,
    AuditLogsModule,
    LoyaltyModule,
    MenuModule,
    CustomerCreditModule,
    CustomerAuthModule,
    CustomerPortalModule,
    AssistantModule,
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap, OnModuleDestroy {
  private warmupTimer?: NodeJS.Timeout;
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantRlsMiddleware).forRoutes('*');
  }

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
    this.installTenantRlsQueryContext();
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

  /**
   * RLS reads current_setting('app.tenant_id') from the PostgreSQL session.
   * TypeORM obtains and releases pooled connections per query, so bind the
   * setting immediately before every query rather than leaving tenant state on
   * a connection after it returns to the pool.
   */
  private installTenantRlsQueryContext(): void {
    const dataSource = this.dataSource as DataSource & { __tenantRlsPatched?: boolean };
    if (dataSource.__tenantRlsPatched) return;
    dataSource.__tenantRlsPatched = true;

    const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);
    dataSource.createQueryRunner = ((mode?: 'master' | 'slave') => {
      const queryRunner: any = createQueryRunner(mode);
      const rawQuery = queryRunner.query.bind(queryRunner);
      queryRunner.query = async (query: string, parameters?: unknown[], useStructuredResult?: boolean) => {
        // Transaction-control statements (BEGIN/COMMIT/ROLLBACK/SAVEPOINT/...)
        // must run standalone. Postgres allows ROLLBACK/ROLLBACK TO SAVEPOINT
        // even once a transaction is aborted — that's how callers recover from
        // it — but prepending set_config ahead of them breaks that recovery:
        // set_config itself gets rejected with "current transaction is aborted",
        // so the ROLLBACK never runs, the transaction stays aborted, and the
        // connection can go back to the pool still poisoned for the next query.
        if (/^\s*(begin|commit|rollback|savepoint|release)\b/i.test(query)) {
          return rawQuery(query, parameters, useStructuredResult);
        }
        const tenantId = this.tenantContext.getTenantId();
        await rawQuery(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId === null ? '' : String(tenantId)]);
        return rawQuery(query, parameters, useStructuredResult);
      };
      return queryRunner;
    }) as DataSource['createQueryRunner'];
  }

  onModuleDestroy() {
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = undefined;
    }
  }
}
