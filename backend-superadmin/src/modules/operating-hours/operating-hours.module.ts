import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { OutletsModule } from '../outlets/outlets.module';
import { SettingsModule } from '../settings/settings.module';
import { OutletOperatingHours } from './entities/outlet-operating-hours.entity';
import { OperationalRequestContextInterceptor } from './operational-request-context.interceptor';
import { OperatingHoursController } from './operating-hours.controller';
import { OperatingHoursService } from './operating-hours.service';

@Module({ imports: [TypeOrmModule.forFeature([OutletOperatingHours]), AuthModule, OutletsModule, AuditLogsModule, SettingsModule], controllers: [OperatingHoursController], providers: [OperatingHoursService, { provide: APP_INTERCEPTOR, useClass: OperationalRequestContextInterceptor }], exports: [OperatingHoursService] })
export class OperatingHoursModule {}
