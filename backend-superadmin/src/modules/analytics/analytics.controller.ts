import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@RequirePermissions('dashboard.view')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  private scopedQuery(
    query: AnalyticsQueryDto,
    request: AuthenticatedRequest & { tenantId?: number },
  ): AnalyticsQueryDto {
    // The superadmin host is tenant-neutral. The tenant detail page sends the
    // selected tenantId explicitly. X-Tenant-Slug remains supported for
    // workspace requests, but is not required here.
    return request.user.isSuperadmin
      ? { ...query, tenantId: request.tenantId ?? query.tenantId }
      : { ...query, tenantId: undefined };
  }

  @Get('overview') overview(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.overview(user, this.scopedQuery(query, request)); }
  @Get('dashboard') dashboard(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.dashboard(user, this.scopedQuery(query, request)); }
  @Get('daily') daily(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.daily(user, this.scopedQuery(query, request)); }
  @Post('daily/refresh') refreshDaily(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.refreshDaily(user, this.scopedQuery(query, request)); }
  @Post('daily/backfill') backfill(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.backfill(user, this.scopedQuery(query, request)); }
  @Get('products') products(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.products(user, this.scopedQuery(query, request)); }
  @Get('inventory') inventory(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.inventory(user, this.scopedQuery(query, request)); }
  @Get('customers') customers(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.analytics.customers(user, this.scopedQuery(query, request)); }
}
