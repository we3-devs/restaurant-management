import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { UNTRACKED_INGREDIENT_TYPES } from '../ingredient-categories/ingredient-category-type.util';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import type {
  DashboardAnalytics,
  DashboardBreakdown,
  DashboardCharts,
  DashboardInventoryActivity,
  DashboardStats,
  DashboardSummary,
  ResolvedRange,
} from '../dashboard/dashboard.service';

/**
 * Holds the actual aggregation queries behind the dashboard's 4 endpoints —
 * moved out of DashboardService so both the precomputed-cache population
 * path (DashboardCacheService) and the live custom-date-range fallback path
 * (DashboardService, for ranges outside the cached default) run the exact
 * same query logic. Only the methods actually consumed by
 * getStats/getCharts/getBreakdown/getInventoryActivity were moved — several
 * DashboardSummary fields (supplierSummary, purchaseSummary, employeeSummary,
 * attendanceSummary, staffOnDuty, recentAuditActivity, loyaltySummary,
 * receivingSummary) were dead code with no call sites and were left in
 * dashboard.service.ts untouched.
 */
@Injectable()
export class DashboardComputeService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(KitchenTicket)
    private readonly kitchenTicketsRepository: Repository<KitchenTicket>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async computeStats(range: ResolvedRange): Promise<DashboardStats> {
    const [
      salesOverview,
      activeTableSessions,
      ordersOverview,
      kitchenOverview,
      wastageSummary,
      paymentBreakdown,
      inventoryOverview,
    ] = await Promise.all([
      this.getSalesOverview(range),
      this.getActiveTableSessions(range),
      this.getOrdersOverview(range),
      this.getKitchenOverview(range),
      this.getWastageSummary(range),
      this.getPaymentBreakdown(range),
      this.getInventoryOverview(range),
    ]);

    return {
      salesOverview,
      activeTableSessions,
      ordersOverview,
      kitchenOverview,
      wastageSummary,
      paymentBreakdown,
      inventoryOverview: {
        lowStockCount: inventoryOverview.lowStockCount,
        outOfStockCount: inventoryOverview.outOfStockCount,
      },
    };
  }

  async computeCharts(range: ResolvedRange): Promise<DashboardCharts> {
    const [revenueTrend, bestSellingFoods] = await Promise.all([
      this.getRevenueTrend(range),
      this.getBestSellingFoods(range),
    ]);
    return { revenueTrend, bestSellingFoods };
  }

  async computeBreakdown(range: ResolvedRange): Promise<DashboardBreakdown> {
    const [ordersOverview, reservationsSummary, paymentBreakdown] =
      await Promise.all([
        this.getOrdersOverview(range),
        this.getReservationsSummary(range),
        this.getPaymentBreakdown(range),
      ]);
    return { ordersOverview, reservationsSummary, paymentBreakdown };
  }

  async computeInventoryActivity(
    range: ResolvedRange,
  ): Promise<DashboardInventoryActivity> {
    const [inventoryOverview, recentActivity] = await Promise.all([
      this.getInventoryOverview(range),
      this.getRecentActivity(range),
    ]);
    return {
      lowStockItems: inventoryOverview.lowStockItems,
      recentActivity,
    };
  }

  private ordersInRange(range: ResolvedRange) {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere("order.status != 'cancelled'");
    if (range.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', { outletId: range.outletId });
    }
    return qb;
  }

  private async getSalesOverview(
    range: ResolvedRange,
  ): Promise<DashboardSummary['salesOverview']> {
    const row = await this.ordersInRange(range)
      .select('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(order.grand_total), 0)', 'grandTotal')
      .getRawOne<{ orderCount: string; grandTotal: string }>();

    const orderCount = Number(row?.orderCount ?? 0);
    const grandTotal = Number(row?.grandTotal ?? 0);
    return {
      orderCount,
      grandTotal,
      avgOrderValue: orderCount > 0 ? grandTotal / orderCount : 0,
    };
  }

  private async getRevenueTrend(
    range: ResolvedRange,
  ): Promise<DashboardSummary['revenueTrend']> {
    const rows = await this.ordersInRange(range)
      .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(order.grand_total), 0)', 'grandTotal')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; orderCount: string; grandTotal: string }>();

    return rows.map((row) => ({
      date: row.date,
      orderCount: Number(row.orderCount),
      grandTotal: Number(row.grandTotal),
    }));
  }

  private async getOrdersOverview(
    range: ResolvedRange,
  ): Promise<DashboardSummary['ordersOverview']> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('order.status');
    if (range.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', { outletId: range.outletId });
    }
    const rows = await qb.getRawMany<{ status: string; count: string }>();
    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
  }

  private async getActiveTableSessions(range: ResolvedRange): Promise<number> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('table_sessions', 'session')
      .where("session.status IN ('active', 'billing')");
    if (range.outletId !== undefined) {
      qb.andWhere('session.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async getReservationsSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['reservationsSummary']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('reservation.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .from('reservations', 'reservation')
      .where('reservation.reserved_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('reservation.status');
    if (range.outletId !== undefined) {
      qb.andWhere('reservation.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    const rows = await qb.getRawMany<{ status: string; count: string }>();
    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
  }

  private async getKitchenOverview(
    range: ResolvedRange,
  ): Promise<DashboardSummary['kitchenOverview']> {
    const qb = this.kitchenTicketsRepository
      .createQueryBuilder('ticket')
      .where('ticket.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      });
    if (range.outletId !== undefined) {
      qb.andWhere('ticket.outlet_id = :outletId', { outletId: range.outletId });
    }

    const [openTickets, inProgressTickets, avgRow] = await Promise.all([
      qb.clone().andWhere("ticket.status = 'open'").getCount(),
      qb.clone().andWhere("ticket.status = 'in_progress'").getCount(),
      qb
        .clone()
        .select(
          'AVG(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60)',
          'avgMinutes',
        )
        .andWhere('ticket.ready_at IS NOT NULL')
        .andWhere('ticket.started_at IS NOT NULL')
        .getRawOne<{ avgMinutes: string | null }>(),
    ]);

    return {
      openTickets,
      inProgressTickets,
      avgPrepMinutes: avgRow?.avgMinutes ? Number(avgRow.avgMinutes) : null,
    };
  }

  private async getInventoryOverview(
    range: ResolvedRange,
  ): Promise<DashboardSummary['inventoryOverview']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('ingredient.id', 'ingredientId')
      .addSelect('ingredient.name', 'ingredientName')
      .addSelect('stock.quantity', 'quantity')
      .addSelect('ingredient.reorder_level', 'reorderLevel')
      .from('warehouse_ingredient_stocks', 'stock')
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = stock.ingredient_id',
      )
      .innerJoin('warehouses', 'warehouse', 'warehouse.id = stock.warehouse_id')
      .innerJoin(
        'ingredient_categories',
        'category',
        'category.id = ingredient.ingredient_category_id',
      )
      .where('ingredient.is_active = true')
      .andWhere('category.type NOT IN (:...untrackedTypes)', {
        untrackedTypes: UNTRACKED_INGREDIENT_TYPES,
      })
      .andWhere(
        '(stock.quantity <= ingredient.reorder_level OR stock.quantity <= ingredient.minimum_stock)',
      );
    if (range.outletId !== undefined) {
      qb.andWhere('warehouse.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }

    const [lowStockRows, totalIngredients] = await Promise.all([
      qb.orderBy('stock.quantity', 'ASC').limit(10).getRawMany<{
        ingredientId: number;
        ingredientName: string;
        quantity: string;
        reorderLevel: string;
      }>(),
      this.ordersRepository.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('ingredients', 'ingredient')
        .innerJoin(
          'ingredient_categories',
          'category',
          'category.id = ingredient.ingredient_category_id',
        )
        .where('ingredient.is_active = true')
        .andWhere('category.type NOT IN (:...untrackedTypes)', {
          untrackedTypes: UNTRACKED_INGREDIENT_TYPES,
        })
        .getRawOne<{ count: string }>(),
    ]);

    const lowStockItems = lowStockRows.map((row) => ({
      ingredientId: Number(row.ingredientId),
      ingredientName: row.ingredientName,
      quantity: Number(row.quantity),
      reorderLevel: Number(row.reorderLevel),
    }));

    return {
      totalIngredients: Number(totalIngredients?.count ?? 0),
      lowStockCount: lowStockItems.filter((item) => item.quantity > 0).length,
      outOfStockCount: lowStockItems.filter((item) => item.quantity <= 0)
        .length,
      lowStockItems,
    };
  }

  private async getWastageSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['wastageSummary']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('wastage.reason', 'reason')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(item.total_cost), 0)', 'totalCost')
      .from('ingredient_wastages', 'wastage')
      .innerJoin(
        'ingredient_wastage_items',
        'item',
        'item.ingredient_wastage_id = wastage.id',
      )
      .innerJoin(
        'warehouses',
        'warehouse',
        'warehouse.id = wastage.warehouse_id',
      )
      .where('wastage.status = :status', { status: 'approved' })
      .andWhere('wastage.wastage_date BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('wastage.reason');
    if (range.outletId !== undefined) {
      qb.andWhere('warehouse.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    const rows = await qb.getRawMany<{
      reason: string;
      quantity: string;
      totalCost: string;
    }>();
    return rows.map((row) => ({
      reason: row.reason,
      quantity: Number(row.quantity),
      totalCost: Number(row.totalCost),
    }));
  }

  private async getPaymentBreakdown(
    range: ResolvedRange,
  ): Promise<DashboardSummary['paymentBreakdown']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('payment.method', 'method')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .from('order_payments', 'payment')
      .where("payment.status = 'completed'")
      .andWhere("payment.type = 'payment'")
      .andWhere('payment.paid_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('payment.method');
    if (range.outletId !== undefined) {
      qb.andWhere('payment.outlet_id = :outletId', { outletId: range.outletId });
    }
    const rows = await qb.getRawMany<{ method: string; amount: string }>();
    return rows.map((row) => ({
      method: row.method,
      amount: Number(row.amount),
    }));
  }

  private async getBestSellingFoods(
    range: ResolvedRange,
  ): Promise<DashboardSummary['bestSellingFoods']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('food.id', 'foodId')
      .addSelect('food.name', 'foodName')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(item.total_amount), 0)', 'revenue')
      .from('order_items', 'item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .innerJoin('foods', 'food', 'food.id = item.food_id')
      .where("order.status != 'cancelled'")
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('food.id')
      .addGroupBy('food.name')
      .orderBy('"quantitySold"', 'DESC')
      .limit(10);
    if (range.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', { outletId: range.outletId });
    }
    const rows = await qb.getRawMany<{
      foodId: number;
      foodName: string;
      quantitySold: string;
      revenue: string;
    }>();
    return rows.map((row) => ({
      foodId: Number(row.foodId),
      foodName: row.foodName,
      quantitySold: Number(row.quantitySold),
      revenue: Number(row.revenue),
    }));
  }

  // ---------------------------------------------------------------------
  // Analytics (`/dashboard/analytics`) — additive aggregations for the new
  // /analytics dashboard page. Kept in this service alongside the existing
  // dashboard queries so they share the same `ordersInRange`-style
  // outlet/date scoping conventions; not wired into the precomputed cache
  // tables (DashboardCacheService) — always computed live, wrapped by the
  // same 60s in-memory cache DashboardService already uses for custom
  // ranges.
  // ---------------------------------------------------------------------

  async computeAnalytics(range: ResolvedRange): Promise<DashboardAnalytics> {
    const [
      peakHours,
      salesByCategory,
      discountRefund,
      orderStatus,
      prepPerformance,
      ingredientConsumption,
      customerAnalytics,
    ] = await Promise.all([
      this.getPeakHours(range),
      this.getSalesByCategory(range),
      this.getDiscountRefund(range),
      this.getOrderStatusAnalytics(range),
      this.getPrepPerformance(range),
      this.getIngredientConsumption(range),
      this.getCustomerAnalytics(range),
    ]);
    return {
      peakHours,
      salesByCategory,
      discountRefund,
      orderStatus,
      prepPerformance,
      ingredientConsumption,
      customerAnalytics,
    };
  }

  private async getPeakHours(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['peakHours']> {
    const rows = await this.ordersInRange(range)
      .select('EXTRACT(HOUR FROM order.created_at)', 'hour')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(order.grand_total), 0)', 'revenue')
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany<{ hour: string; orderCount: string; revenue: string }>();

    return rows.map((row) => ({
      hour: Number(row.hour),
      orderCount: Number(row.orderCount),
      revenue: Number(row.revenue),
    }));
  }

  private async getSalesByCategory(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['salesByCategory']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('COALESCE(SUM(item.total_amount), 0)', 'revenue')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'orderCount')
      .from('order_items', 'item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .innerJoin('foods', 'food', 'food.id = item.food_id')
      .innerJoin(
        'food_categories',
        'category',
        'category.id = food.food_category_id',
      )
      .where("order.status != 'cancelled'")
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('"revenue"', 'DESC');
    if (range.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', { outletId: range.outletId });
    }
    const rows = await qb.getRawMany<{
      categoryId: number;
      categoryName: string;
      revenue: string;
      orderCount: string;
    }>();
    return rows.map((row) => ({
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName,
      revenue: Number(row.revenue),
      orderCount: Number(row.orderCount),
    }));
  }

  private async getDiscountRefund(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['discountRefund']> {
    const [totalsRow, refundRow, trendRows, orderCount] = await Promise.all([
      this.ordersInRange(range)
        .select('COALESCE(SUM(order.discount_amount), 0)', 'totalDiscount')
        .addSelect(
          'COUNT(*) FILTER (WHERE order.discount_amount > 0)',
          'discountedOrderCount',
        )
        .getRawOne<{ totalDiscount: string; discountedOrderCount: string }>(),
      (() => {
        const qb = this.ordersRepository.manager
          .createQueryBuilder()
          .select('COALESCE(SUM(payment.amount), 0)', 'totalRefunded')
          .addSelect('COUNT(*)', 'refundCount')
          .from('order_payments', 'payment')
          .where("payment.type = 'refund'")
          .andWhere("payment.status = 'completed'")
          .andWhere('payment.paid_at BETWEEN :from AND :to', {
            from: range.from,
            to: range.to,
          });
        if (range.outletId !== undefined) {
          qb.andWhere('payment.outlet_id = :outletId', {
            outletId: range.outletId,
          });
        }
        return qb.getRawOne<{ totalRefunded: string; refundCount: string }>();
      })(),
      this.ordersInRange(range)
        .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect('COALESCE(SUM(order.discount_amount), 0)', 'discountAmount')
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; discountAmount: string }>(),
      this.ordersInRange(range).getCount(),
    ]);

    const totalDiscount = Number(totalsRow?.totalDiscount ?? 0);
    const discountedOrderCount = Number(totalsRow?.discountedOrderCount ?? 0);
    const totalRefunded = Number(refundRow?.totalRefunded ?? 0);
    const refundCount = Number(refundRow?.refundCount ?? 0);

    return {
      totalDiscount,
      discountedOrderCount,
      avgDiscount:
        discountedOrderCount > 0 ? totalDiscount / discountedOrderCount : 0,
      totalRefunded,
      refundCount,
      refundRate: orderCount > 0 ? (refundCount / orderCount) * 100 : 0,
      trend: trendRows.map((row) => ({
        date: row.date,
        discountAmount: Number(row.discountAmount),
      })),
    };
  }

  private async getOrderStatusAnalytics(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['orderStatus']> {
    const rows = await this.getOrdersOverview(range);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => ({
      status: row.status,
      count: row.count,
      percentage: total > 0 ? (row.count / total) * 100 : 0,
    }));
  }

  private async getPrepPerformance(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['prepPerformance']> {
    const EXPECTED_MINUTES = 20;
    const qb = this.kitchenTicketsRepository
      .createQueryBuilder('ticket')
      .where('ticket.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('ticket.ready_at IS NOT NULL')
      .andWhere('ticket.started_at IS NOT NULL');
    if (range.outletId !== undefined) {
      qb.andWhere('ticket.outlet_id = :outletId', { outletId: range.outletId });
    }

    const [summaryRow, trendRows] = await Promise.all([
      qb
        .clone()
        .select(
          'AVG(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60)',
          'avgMinutes',
        )
        .addSelect(
          'MIN(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60)',
          'fastestMinutes',
        )
        .addSelect(
          'MAX(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60)',
          'slowestMinutes',
        )
        .addSelect('COUNT(*)', 'totalTickets')
        .addSelect(
          `COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60 <= ${EXPECTED_MINUTES})`,
          'onTimeCount',
        )
        .getRawOne<{
          avgMinutes: string | null;
          fastestMinutes: string | null;
          slowestMinutes: string | null;
          totalTickets: string;
          onTimeCount: string;
        }>(),
      qb
        .clone()
        .select("TO_CHAR(ticket.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect(
          'AVG(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60)',
          'avgMinutes',
        )
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; avgMinutes: string }>(),
    ]);

    const totalTickets = Number(summaryRow?.totalTickets ?? 0);
    const onTimeCount = Number(summaryRow?.onTimeCount ?? 0);

    return {
      expectedMinutes: EXPECTED_MINUTES,
      avgMinutes: summaryRow?.avgMinutes ? Number(summaryRow.avgMinutes) : null,
      fastestMinutes: summaryRow?.fastestMinutes
        ? Number(summaryRow.fastestMinutes)
        : null,
      slowestMinutes: summaryRow?.slowestMinutes
        ? Number(summaryRow.slowestMinutes)
        : null,
      totalTickets,
      onTimeCount,
      delayedCount: totalTickets - onTimeCount,
      trend: trendRows.map((row) => ({
        date: row.date,
        avgMinutes: Number(row.avgMinutes),
      })),
    };
  }

  private async getIngredientConsumption(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['ingredientConsumption']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('ingredient.id', 'ingredientId')
      .addSelect('ingredient.name', 'ingredientName')
      .addSelect(
        'COALESCE(SUM(reservation.consumed_quantity), 0)',
        'totalConsumed',
      )
      .addSelect('unit.name', 'unitName')
      .from('order_item_ingredient_reservations', 'reservation')
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = reservation.ingredient_id',
      )
      .leftJoin('units', 'unit', 'unit.id = ingredient.base_unit_id')
      .innerJoin('order_items', 'item', 'item.id = reservation.order_item_id')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .innerJoin(
        'ingredient_categories',
        'category',
        'category.id = ingredient.ingredient_category_id',
      )
      .where('"order".created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('category.type NOT IN (:...untrackedTypes)', {
        untrackedTypes: UNTRACKED_INGREDIENT_TYPES,
      })
      .groupBy('ingredient.id')
      .addGroupBy('ingredient.name')
      .addGroupBy('unit.name');
    if (range.outletId !== undefined) {
      qb.andWhere('"order".outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    const rows = await qb.getRawMany<{
      ingredientId: number;
      ingredientName: string;
      totalConsumed: string;
      unitName: string | null;
    }>();

    const mapped = rows.map((row) => ({
      ingredientId: Number(row.ingredientId),
      ingredientName: row.ingredientName,
      totalConsumed: Number(row.totalConsumed),
      unitName: row.unitName,
    }));
    const sorted = [...mapped].sort((a, b) => b.totalConsumed - a.totalConsumed);
    return {
      mostConsumed: sorted.slice(0, 10),
      leastConsumed: sorted
        .filter((row) => row.totalConsumed > 0)
        .slice(-10)
        .reverse(),
    };
  }

  private async getCustomerAnalytics(
    range: ResolvedRange,
  ): Promise<DashboardAnalytics['customerAnalytics']> {
    const outletFilter =
      range.outletId !== undefined ? 'AND "order".outlet_id = :outletId' : '';

    // First-ever order date per customer who ordered in-range, compared to
    // that customer's lifetime order count as of the range end, to classify
    // new (first order falls inside the range) vs returning (had at least
    // one order before the range and ordered again inside it).
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('customer.id', 'customerId')
      .addSelect('MIN("order".created_at)', 'firstOrderAt')
      .addSelect(
        'COUNT(*) FILTER (WHERE "order".created_at BETWEEN :from AND :to)',
        'ordersInRange',
      )
      .addSelect(
        'COALESCE(SUM("order".grand_total) FILTER (WHERE "order".created_at BETWEEN :from AND :to), 0)',
        'spendInRange',
      )
      .from('customers', 'customer')
      .innerJoin(
        'orders',
        'order',
        `"order".customer_id = customer.id AND "order".status != 'cancelled' ${outletFilter}`,
        { outletId: range.outletId },
      )
      .where('1=1')
      .setParameters({ from: range.from, to: range.to })
      .groupBy('customer.id')
      .having(
        'COUNT(*) FILTER (WHERE "order".created_at BETWEEN :from AND :to) > 0',
      );
    const rows = await qb.getRawMany<{
      customerId: number;
      firstOrderAt: string;
      ordersInRange: string;
      spendInRange: string;
    }>();

    let newCustomers = 0;
    let returningCustomers = 0;
    let totalSpend = 0;
    let totalOrders = 0;
    for (const row of rows) {
      const firstOrderAt = new Date(row.firstOrderAt);
      const isNew = firstOrderAt >= range.from;
      if (isNew) newCustomers += 1;
      else returningCustomers += 1;
      totalSpend += Number(row.spendInRange);
      totalOrders += Number(row.ordersInRange);
    }
    const totalCustomers = rows.length;

    const trendRows = await this.ordersRepository.manager.query(
      `
      SELECT day::date AS date,
        COUNT(DISTINCT customer_orders.customer_id) FILTER (WHERE first_order.first_order_at::date = day::date) AS "newCount",
        COUNT(DISTINCT customer_orders.customer_id) FILTER (WHERE first_order.first_order_at::date < day::date) AS "returningCount"
      FROM generate_series($1::date, $2::date, interval '1 day') AS day
      LEFT JOIN LATERAL (
        SELECT DISTINCT "order".customer_id
        FROM orders "order"
        WHERE "order".status != 'cancelled'
          AND "order".created_at::date = day::date
          ${range.outletId !== undefined ? 'AND "order".outlet_id = $3' : ''}
      ) customer_orders ON true
      LEFT JOIN LATERAL (
        SELECT MIN(o2.created_at) AS first_order_at
        FROM orders o2
        WHERE o2.customer_id = customer_orders.customer_id AND o2.status != 'cancelled'
          ${range.outletId !== undefined ? 'AND o2.outlet_id = $3' : ''}
      ) first_order ON true
      WHERE customer_orders.customer_id IS NOT NULL
      GROUP BY day
      ORDER BY day ASC
      `,
      range.outletId !== undefined
        ? [range.from, range.to, range.outletId]
        : [range.from, range.to],
    );

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      avgSpend: totalCustomers > 0 ? totalSpend / totalCustomers : 0,
      avgOrdersPerCustomer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
      trend: (
        trendRows as { date: string; newCount: string; returningCount: string }[]
      ).map((row) => ({
        date:
          typeof row.date === 'string'
            ? row.date
            : new Date(row.date).toISOString().slice(0, 10),
        newCount: Number(row.newCount),
        returningCount: Number(row.returningCount),
      })),
    };
  }

  private async getRecentActivity(
    range: ResolvedRange,
  ): Promise<DashboardSummary['recentActivity']> {
    const feed = await this.notificationsService.findAll({
      outletId: range.outletId,
      page: 1,
      limit: 20,
    });
    return feed.data;
  }
}
