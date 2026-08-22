import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PeriodInsightsQueryDto } from './dto/period-insights-query.dto';
import { PeriodInsightsNpService } from './period-insights-np.service';
import { PeriodInsightsService } from './period-insights.service';

@ApiTags('period-insights')
@ApiBearerAuth()
@Controller('period-insights')
export class PeriodInsightsController {
  constructor(
    private readonly periodInsightsService: PeriodInsightsService,
    private readonly periodInsightsNpService: PeriodInsightsNpService,
  ) {}

  @Get()
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Persisted daily/weekly/monthly rollups (AD calendar) of orders/payments/kitchen/wastage into actionable insight numbers, most recent period first.',
  })
  list(@Query() query: PeriodInsightsQueryDto) {
    return this.periodInsightsService.list({
      outletId: query.outletId,
      periodType: query.periodType,
      limit: query.limit,
    });
  }

  @Post('rebuild')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Manually re-runs the AD daily/weekly/monthly rollup for the current period boundaries. Idempotent — safe to call any time.',
  })
  rebuild() {
    return this.periodInsightsService.rollupAll();
  }

  @Get('np')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Persisted daily/weekly/monthly rollups on real Bikram Sambat (Nepali) calendar boundaries — Baisakh-Chaitra months, Sun-Sat weeks — most recent period first.',
  })
  listNp(@Query() query: PeriodInsightsQueryDto) {
    return this.periodInsightsNpService.list({
      outletId: query.outletId,
      periodType: query.periodType,
      limit: query.limit,
    });
  }

  @Post('np/rebuild')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary:
      'Manually re-runs the BS daily/weekly/monthly rollup for the current period boundaries. Idempotent — safe to call any time.',
  })
  rebuildNp() {
    return this.periodInsightsNpService.rollupAll();
  }
}
