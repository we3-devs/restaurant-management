import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimestampSubscriber } from '../../common/subscribers/timestamp.subscriber';
import configuration, { AppConfig } from '../../config/configuration';
import { validate } from '../../config/env.validation';
import { OutletDepartmentsModule } from '../../modules/outlet-departments/outlet-departments.module';
import { OutletsModule } from '../../modules/outlets/outlets.module';
import { RolesModule } from '../../modules/roles/roles.module';
import { UsersModule } from '../../modules/users/users.module';
import { WarehousesModule } from '../../modules/warehouses/warehouses.module';

/**
 * Minimal bootstrap for the seed script — DB access only, no Redis/BullMQ,
 * so seeding doesn't require the whole app's infra (Redis) to be running.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
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
  ],
})
export class SeedModule {}
