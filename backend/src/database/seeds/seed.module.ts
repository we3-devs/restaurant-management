import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimestampSubscriber } from '../../common/subscribers/timestamp.subscriber';
import { TenantModule } from '../../common/tenant/tenant.module';
import { WsTicketsModule } from '../../common/ws-tickets/ws-tickets.module';
import configuration, { AppConfig } from '../../config/configuration';
import { validate } from '../../config/env.validation';
import { EmployeesModule } from '../../modules/employees/employees.module';
import { OutletDepartmentsModule } from '../../modules/outlet-departments/outlet-departments.module';
import { OutletsModule } from '../../modules/outlets/outlets.module';
import { PermissionsModule } from '../../modules/permissions/permissions.module';
import { UsersModule } from '../../modules/users/users.module';
import { WarehousesModule } from '../../modules/warehouses/warehouses.module';

/**
 * Minimal bootstrap for the seed script — DB access only, none of the rest
 * of the app's module graph, so seeding stays fast and side-effect-free.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    CacheModule.register({ isGlobal: true }),
    // @Global, so importing it here makes TenantContext resolvable by every
    // tenant-scoped service the seed pulls in (OutletsService and friends).
    // app.module.ts imports it for the running app; without it here the seed
    // dies on "Nest can't resolve dependencies of the OutletsService".
    TenantModule,
    WsTicketsModule,
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
          synchronize: false,
          // Glob every entity rather than autoLoadEntities, which only
          // registers what the imported modules declare via forFeature —
          // relations reaching outside that subset (Attendance#shift) then
          // fail metadata resolution. Mirrors data-source.ts's own glob.
          entities: ['src/modules/**/*.entity.ts'],
          migrationsTableName: 'typeorm_migrations',
          subscribers: [TimestampSubscriber],
        };
      },
    }),
    UsersModule,
    PermissionsModule,
    OutletsModule,
    OutletDepartmentsModule,
    WarehousesModule,
    EmployeesModule,
  ],
})
export class SeedModule {}
