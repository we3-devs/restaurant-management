import { Controller, Get, Query } from '@nestjs/common';
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
  @Get('products') products(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.products(user, query); }
  @Get('inventory') inventory(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.inventory(user, query); }
  @Get('customers') customers(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) { return this.analytics.customers(user, query); }
}
