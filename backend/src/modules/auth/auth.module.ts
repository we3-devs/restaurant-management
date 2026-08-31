import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AppConfig } from '../../config/configuration';
import { InstrumentationModule } from '../../common/instrumentation/instrumentation.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PresenceGuard } from './guards/presence.guard';
import { OutletAccessService } from './outlet-access.service';
import { PermissionsService } from './permissions.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    AuditLogsModule,
    InstrumentationModule,
    TypeOrmModule.forFeature([RefreshToken, Attendance]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfig>,
      ): JwtModuleOptions => {
        const jwtConfig = configService.get('jwt', { infer: true })!;
        return {
          secret: jwtConfig.accessSecret,
          // accessExpiresIn is a validated env string (e.g. "15m"); @nestjs/jwt's
          // stricter StringValue type can't express "arbitrary validated string".
          signOptions: {
            expiresIn:
              jwtConfig.accessExpiresIn as unknown as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PermissionsService,
    OutletAccessService,
    JwtAccessStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PresenceGuard },
  ],
  exports: [PermissionsService, OutletAccessService],
})
export class AuthModule {}
