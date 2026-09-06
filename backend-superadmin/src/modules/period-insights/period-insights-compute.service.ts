import { Injectable } from '@nestjs/common';
import { DashboardComputeService } from '../dashboard-cache/dashboard-compute.service';
import type { ResolvedRange } from '../dashboard/dashboard.service';
import type { PeriodInsightPayload } from './entities/period-insight.entity';

/**
 * Builds one period_insights payload from the same aggregation queries the
 * live dashboard uses (DashboardComputeService), so a daily/weekly/monthly
 * rollup and the dashboard's own numbers can never silently diverge.
 */
@Injectable()
export class PeriodInsightsComputeService {
  constructor(private readonly compute: DashboardComputeService) {}

  async computePayload(range: ResolvedRange): Promise<PeriodInsightPayload> {
    const [stats, charts] = await Promise.all([
      this.compute.computeStats(range),
      this.compute.computeCharts(range),
    ]);

    return {
      salesOverview: stats.salesOverview,
      ordersOverview: stats.ordersOverview,
      paymentBreakdown: stats.paymentBreakdown,
      kitchenOverview: stats.kitchenOverview,
      wastageSummary: stats.wastageSummary,
      bestSellingFoods: charts.bestSellingFoods,
      revenueTrend: charts.revenueTrend,
    };
  }
}
