import { Module } from '@nestjs/common';
import { DashboardCacheModule } from '../dashboard-cache/dashboard-cache.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DashboardCacheModule, AuthModule, SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
