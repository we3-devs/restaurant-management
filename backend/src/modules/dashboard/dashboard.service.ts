import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { DashboardCacheService } from '../dashboard-cache/dashboard-cache.service';
import { DashboardComputeService } from '../dashboard-cache/dashboard-compute.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_RANGE_DAYS } from './dashboard.constants';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const CACHE_TTL_MS = 60_000;
export { DEFAULT_RANGE_DAYS };

export interface ResolvedRange {
  outletId?: number;
  from: Date;
  to: Date;
}

export interface DashboardSummary {
  salesOverview: {
    orderCount: number;
    grandTotal: number;
    avgOrderValue: number;
  };
  revenueTrend: { date: string; orderCount: number; grandTotal: number }[];
  ordersOverview: { status: string; count: number }[];
  activeTableSessions: number;
  reservationsSummary: { status: string; count: number }[];
  kitchenOverview: {
    openTickets: number;
    inProgressTickets: number;
    avgPrepMinutes: number | null;
  };
  inventoryOverview: {
    totalIngredients: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: {
      ingredientId: number;
      ingredientName: string;
      quantity: number;
      reorderLevel: number;
    }[];
  };
  wastageSummary: { reason: string; quantity: number; totalCost: number }[];
  paymentBreakdown: { method: string; amount: number }[];
  bestSellingFoods: {
    foodId: number;
    foodName: string;
    quantitySold: number;
    revenue: number;
  }[];
  recentActivity: Awaited<ReturnType<NotificationsService['findAll']>>['data'];
}

export type DashboardStats = Pick<
  DashboardSummary,
  | 'salesOverview'
  | 'activeTableSessions'
  | 'ordersOverview'
  | 'kitchenOverview'
  | 'wastageSummary'
  | 'paymentBreakdown'
> & {
  inventoryOverview: Pick<
    DashboardSummary['inventoryOverview'],
    'lowStockCount' | 'outOfStockCount'
  >;
};

export type DashboardCharts = Pick<
  DashboardSummary,
  'revenueTrend' | 'bestSellingFoods'
>;

export type DashboardBreakdown = Pick<
  DashboardSummary,
  'ordersOverview' | 'reservationsSummary' | 'paymentBreakdown'
>;

export interface DashboardInventoryActivity {
  lowStockItems: DashboardSummary['inventoryOverview']['lowStockItems'];
  recentActivity: DashboardSummary['recentActivity'];
}

/** Aggregations backing the `/analytics` dashboard page's Sales/Finance/Operations/Inventory/Customers tabs. */
export interface DashboardAnalytics {
  peakHours: { hour: number; orderCount: number; revenue: number }[];
  salesByCategory: {
    categoryId: number;
    categoryName: string;
    revenue: number;
    orderCount: number;
  }[];
  discountRefund: {
    totalDiscount: number;
    discountedOrderCount: number;
    avgDiscount: number;
    totalRefunded: number;
    refundCount: number;
    refundRate: number;
    trend: { date: string; discountAmount: number }[];
  };
  orderStatus: { status: string; count: number; percentage: number }[];
  prepPerformance: {
    expectedMinutes: number;
    avgMinutes: number | null;
    fastestMinutes: number | null;
    slowestMinutes: number | null;
    totalTickets: number;
    onTimeCount: number;
    delayedCount: number;
    trend: { date: string; avgMinutes: number }[];
  };
  ingredientConsumption: {
    mostConsumed: {
      ingredientId: number;
      ingredientName: string;
      totalConsumed: number;
      unitName: string | null;
    }[];
    leastConsumed: {
      ingredientId: number;
      ingredientName: string;
      totalConsumed: number;
      unitName: string | null;
    }[];
  };
  customerAnalytics: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    avgSpend: number;
    avgOrdersPerCustomer: number;
    trend: { date: string; newCount: number; returningCount: number }[];
  };
}

/**
 * Thin router: the default date range (no dateFrom/dateTo, or an explicit
 * range matching it) reads from DashboardCacheService's precomputed cache
 * tables — a single indexed SELECT per endpoint. A genuine custom range
 * (the DateRangeFilter on the dashboard page lets users pick one) still
 * computes live via DashboardComputeService, guarded by the same in-memory
 * 60s cache as before. The actual aggregation queries live in
 * DashboardComputeService so both paths run identical logic.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly cacheService: DashboardCacheService,
    private readonly compute: DashboardComputeService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Custom ranges get an exact-timestamp key (each distinct range is its own
   * cache entry). The default range deliberately does NOT include `to` in
   * the key — `to` is `new Date()` at call time, so keying on it would make
   * every request a unique key and defeat the cache entirely. Defaulting to
   * a stable per-outlet key means this in-memory layer is what actually
   * makes repeat requests fast: DashboardCacheService's Postgres-backed
   * cache still gets hit on every miss here, but a miss here only happens
   * once per CACHE_TTL_MS per outlet, not once per HTTP request.
   */
  private cacheKey(
    name: string,
    range: ResolvedRange,
    isDefault: boolean,
  ): string {
    if (isDefault) {
      return `dashboard:${name}:default:${range.outletId ?? 'all'}`;
    }
    return `dashboard:${name}:${range.outletId ?? 'all'}:${range.from.toISOString()}:${range.to.toISOString()}`;
  }

  async getStats(query: DashboardQueryDto): Promise<DashboardStats> {
    const range = this.resolveRange(query);
    const isDefault = this.isDefaultRange(query, range);
    return this.cache.wrap(
      this.cacheKey('stats', range, isDefault),
      () =>
        isDefault
          ? this.cacheService.getStats(range.outletId)
          : this.compute.computeStats(range),
      CACHE_TTL_MS,
    );
  }

  async getCharts(query: DashboardQueryDto): Promise<DashboardCharts> {
    const range = this.resolveRange(query);
    const isDefault = this.isDefaultRange(query, range);
    return this.cache.wrap(
      this.cacheKey('charts', range, isDefault),
      () =>
        isDefault
          ? this.cacheService.getCharts(range.outletId)
          : this.compute.computeCharts(range),
      CACHE_TTL_MS,
    );
  }

  async getBreakdown(query: DashboardQueryDto): Promise<DashboardBreakdown> {
    const range = this.resolveRange(query);
    const isDefault = this.isDefaultRange(query, range);
    return this.cache.wrap(
      this.cacheKey('breakdown', range, isDefault),
      () =>
        isDefault
          ? this.cacheService.getBreakdown(range.outletId)
          : this.compute.computeBreakdown(range),
      CACHE_TTL_MS,
    );
  }

  async getInventoryActivity(
    query: DashboardQueryDto,
  ): Promise<DashboardInventoryActivity> {
    const range = this.resolveRange(query);
    // Not range-bound (see DashboardComputeService), so it's always safe to
    // serve from cache regardless of the requested date range.
    return this.cache.wrap(
      `dashboard:inventory-activity:default:${range.outletId ?? 'all'}`,
      () => this.cacheService.getInventoryActivity(range.outletId),
      CACHE_TTL_MS,
    );
  }

  /**
   * Analytics for `/analytics`: current-range aggregations plus the
   * equivalent-length immediately-preceding range, so the frontend's
   * insights strip can compute real % changes (revenue, busiest hour
   * shift, etc.) without a second round trip. Not backed by the
   * precomputed cache tables — always computed live, wrapped by the same
   * 60s in-memory cache as the custom-range fallback paths above.
   */
  async getAnalytics(query: DashboardQueryDto): Promise<{
    current: DashboardAnalytics;
    previous: DashboardAnalytics;
  }> {
    const range = this.resolveRange(query);
    const durationMs = range.to.getTime() - range.from.getTime();
    const previousRange: ResolvedRange = {
      outletId: range.outletId,
      from: new Date(range.from.getTime() - durationMs),
      to: new Date(range.from.getTime()),
    };
    const isDefault = this.isDefaultRange(query, range);
    return this.cache.wrap(
      this.cacheKey('analytics', range, isDefault),
      async () => {
        const [current, previous] = await Promise.all([
          this.compute.computeAnalytics(range),
          this.compute.computeAnalytics(previousRange),
        ]);
        return { current, previous };
      },
      CACHE_TTL_MS,
    );
  }

  private resolveRange(query: DashboardQueryDto): ResolvedRange {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60_000);
    return { outletId: query.outletId, from, to };
  }

  /**
   * True when the request is for "the default range" — either no
   * dateFrom/dateTo at all, or an explicit range that happens to match it
   * (same calendar day as today for `to`, exactly DEFAULT_RANGE_DAYS
   * earlier for `from`). Only this case is served from the precomputed
   * cache; anything else (a real custom range picked in the UI) computes
   * live, unchanged from before this cache existed.
   */
  private isDefaultRange(
    query: DashboardQueryDto,
    range: ResolvedRange,
  ): boolean {
    if (!query.dateFrom && !query.dateTo) return true;
    const expected = this.resolveRange({ outletId: query.outletId });
    return (
      range.to.toDateString() === expected.to.toDateString() &&
      range.from.toDateString() === expected.from.toDateString()
    );
  }
}
