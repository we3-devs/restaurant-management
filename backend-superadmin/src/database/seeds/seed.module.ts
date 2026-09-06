import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimestampSubscriber } from '../../common/subscribers/timestamp.subscriber';
import { WsTicketsModule } from '../../common/ws-tickets/ws-tickets.module';
import configuration, { AppConfig } from '../../config/configuration';
import { validate } from '../../config/env.validation';
import { EmployeesModule } from '../../modules/employees/employees.module';
import { OutletDepartmentsModule } from '../../modules/outlet-departments/outlet-departments.module';
import { OutletsModule } from '../../modules/outlets/outlets.module';
import { RolesModule } from '../../modules/roles/roles.module';
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
          autoLoadEntities: true,
          migrationsTableName: 'typeorm_migrations',
          subscribers: [TimestampSubscriber],
        };
      },
    }),
    UsersModule,
    RolesModule,
    OutletsModule,
    OutletDepartmentsModule,
    WarehousesModule,
    EmployeesModule,
  ],
})
export class SeedModule {}
