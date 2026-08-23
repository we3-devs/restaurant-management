import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
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
  getStats(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getStats(query);
  }

  @Get('charts')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Revenue trend and best-selling foods, for the two dashboard chart cards. Cached ~60s per outlet/date-range.',
  })
  getCharts(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getCharts(query);
  }

  @Get('breakdown')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Orders-by-status, reservations, and payment-method breakdowns. Cached ~60s per outlet/date-range.',
  })
  getBreakdown(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getBreakdown(query);
  }

  @Get('inventory-activity')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Low-stock ingredient list and recent activity feed. Cached ~60s per outlet/date-range.',
  })
  getInventoryActivity(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getInventoryActivity(query);
  }

  @Get('analytics')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Sales/Finance/Operations/Inventory/Customers analytics for the /analytics page: peak hours, sales by category, discount & refund totals with trend, order status %, kitchen prep performance, ingredient consumption ranking, and new-vs-returning customers. Returns both the requested range and the equivalent prior range for computing % changes. Cached ~60s per outlet/date-range.',
  })
  getAnalytics(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getAnalytics(query);
  }
}
