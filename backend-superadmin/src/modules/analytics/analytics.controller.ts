import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@RequirePermissions('dashboard.view')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview') overview(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.overview(user, query); }
  @Get('dashboard') dashboard(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.dashboard(user, query); }
  @Get('daily') daily(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.daily(user, query); }
  @Post('daily/refresh') refreshDaily(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.refreshDaily(user, query); }
  @Post('daily/backfill') backfill(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.backfill(user, query); }
  @Get('products') products(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.products(user, query); }
  @Get('inventory') inventory(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.inventory(user, query); }
  @Get('customers') customers(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.customers(user, query); }
}
