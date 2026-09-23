import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { UNTRACKED_INGREDIENT_TYPES } from '../ingredient-categories/ingredient-category-type.util';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import type {
  DashboardBreakdown,
  DashboardCharts,
  DashboardInventoryActivity,
  DashboardStats,
  DashboardSummary,
  ResolvedRange,
} from '../dashboard/dashboard.service';

/**
 * Holds the actual aggregation queries behind the dashboard's 4 endpoints â€”
 * moved out of DashboardService so both the precomputed-cache population
 * path (DashboardCacheService) and the live custom-date-range fallback path
 * (DashboardService, for ranges outside the cached default) run the exact
 * same query logic. Only the methods actually consumed by
 * getStats/getCharts/getBreakdown/getInventoryActivity were moved â€” several
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

  /**
   * Revenue-bearing orders only: excludes cancelled orders AND orders that
   * haven't been paid yet, since revenue should reflect money actually
   * collected, not orders merely placed.
   *
   * A "credit" payment settles the order (payment_status can reach 'paid')
   * but isn't money collected yet — it's a charge to the customer's tab,
   * settled later via POST /customer-credit/settlements. Joins each order's
   * completed credit-payment total here so callers can subtract it from
   * grand_total, instead of counting the charge as revenue the moment it's
   * put on the tab.
   */
  private ordersInRange(range: ResolvedRange) {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoin(
        (subQuery) =>
          subQuery
            .select('payment.order_id', 'orderId')
            .addSelect('SUM(payment.amount)', 'amount')
            .from('order_payments', 'payment')
            .where("payment.method = 'credit'")
            .andWhere("payment.type = 'payment'")
            .andWhere("payment.status = 'completed'")
            .groupBy('payment.order_id'),
        'credit_payments',
        'credit_payments."orderId" = order.id',
      )
      .where('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere("order.status != 'cancelled'")
      .andWhere("order.payment_status = 'paid'");
    if (range.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', { outletId: range.outletId });
    }
    return qb;
  }

  /** grand_total net of whatever portion of the order was charged to a customer's credit tab rather than actually collected. */
  private static readonly COLLECTED_TOTAL_SQL =
    'order.grand_total - COALESCE(credit_payments.amount, 0)';

  /**
   * Credit settlements collected in range, scoped the same way ordersInRange
   * is. Stored as a negative delta on the account ledger (see
   * CustomerCreditService#settleDebt), so this flips the sign back to a
   * positive amount actually received. Not tied to an order — it's real
   * cash coming in for whatever the customer previously charged to their
   * tab, recognized as revenue on the day it's actually collected rather
   * than the day the original order was placed.
   */
  private settlementsInRange(range: ResolvedRange) {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .from('customer_credit_transactions', 'settlement')
      .where("settlement.type = 'settlement'")
      .andWhere('settlement.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      });
    if (range.outletId !== undefined) {
      qb.andWhere('settlement.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    return qb;
  }

  private async getSalesOverview(
    range: ResolvedRange,
  ): Promise<DashboardSummary['salesOverview']> {
    const [row, settlementRow] = await Promise.all([
      this.ordersInRange(range)
        .select('COUNT(*)', 'orderCount')
        .addSelect(
          `COALESCE(SUM(${DashboardComputeService.COLLECTED_TOTAL_SQL}), 0)`,
          'grandTotal',
        )
        .getRawOne<{ orderCount: string; grandTotal: string }>(),
      this.settlementsInRange(range)
        .select('COALESCE(SUM(-settlement.amount), 0)', 'amount')
        .getRawOne<{ amount: string }>(),
    ]);

    const orderCount = Number(row?.orderCount ?? 0);
    const collectedFromOrders = Number(row?.grandTotal ?? 0);
    const settled = Number(settlementRow?.amount ?? 0);
    return {
      orderCount,
      grandTotal: collectedFromOrders + settled,
      // Kept order-only: a settlement isn't a new order, so folding it in
      // here would understate/overstate the average for reasons that have
      // nothing to do with order size.
      avgOrderValue: orderCount > 0 ? collectedFromOrders / orderCount : 0,
    };
  }

  private async getRevenueTrend(
    range: ResolvedRange,
  ): Promise<DashboardSummary['revenueTrend']> {
    const [rows, settlementRows] = await Promise.all([
      this.ordersInRange(range)
        .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'orderCount')
        .addSelect(
          `COALESCE(SUM(${DashboardComputeService.COLLECTED_TOTAL_SQL}), 0)`,
          'grandTotal',
        )
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; orderCount: string; grandTotal: string }>(),
      this.settlementsInRange(range)
        .select("TO_CHAR(settlement.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect('COALESCE(SUM(-settlement.amount), 0)', 'amount')
        .groupBy('date')
        .getRawMany<{ date: string; amount: string }>(),
    ]);

    const byDate = new Map<string, { orderCount: number; grandTotal: number }>();
    for (const row of rows) {
      byDate.set(row.date, { orderCount: Number(row.orderCount), grandTotal: Number(row.grandTotal) });
    }
    for (const settlementRow of settlementRows) {
      const existing = byDate.get(settlementRow.date);
      const settled = Number(settlementRow.amount);
      if (existing) {
        existing.grandTotal += settled;
      } else {
        byDate.set(settlementRow.date, { orderCount: 0, grandTotal: settled });
      }
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({ date, ...totals }));
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
      .andWhere("order.payment_status = 'paid'")
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
