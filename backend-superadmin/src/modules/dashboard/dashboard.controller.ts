import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Top stat cards: sales, active table sessions, orders, kitchen, wastage total, payments total, low/out-of-stock counts. Cached ~60s per outlet/date-range.',
  })
  getStats(@CurrentUser() user: User, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getStats(user, query);
  }

  @Get('charts')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Revenue trend and best-selling foods, for the two dashboard chart cards. Cached ~60s per outlet/date-range.',
  })
  getCharts(@CurrentUser() user: User, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getCharts(user, query);
  }

  @Get('breakdown')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Orders-by-status, reservations, and payment-method breakdowns. Cached ~60s per outlet/date-range.',
  })
  getBreakdown(@CurrentUser() user: User, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getBreakdown(user, query);
  }

  @Get('inventory-activity')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Low-stock ingredient list and recent activity feed. Cached ~60s per outlet/date-range.',
  })
  getInventoryActivity(@CurrentUser() user: User, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getInventoryActivity(user, query);
  }
}
