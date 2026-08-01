import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/configuration';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DiningTablesModule } from '../dining-tables/dining-tables.module';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { JwtCustomerStrategy } from './strategies/jwt-customer.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    PassportModule,
    DiningTablesModule,
    AuditLogsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfig>,
      ): JwtModuleOptions => ({
        secret: configService.get('jwt', { infer: true })!.accessSecret,
      }),
    }),
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, JwtCustomerStrategy],
  exports: [],
})
export class CustomerAuthModule {}
