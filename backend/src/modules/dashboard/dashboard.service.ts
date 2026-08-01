import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const CACHE_TTL_MS = 60_000;
const DEFAULT_RANGE_DAYS = 30;

interface ResolvedRange {
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
  supplierSummary: {
    activeCount: number;
    totalOutstanding: number;
    overCreditLimitCount: number;
    topSuppliers: {
      supplierId: number;
      companyName: string;
      outstandingBalance: number;
    }[];
  };
  purchaseSummary: {
    pendingApproval: number;
    approved: number;
    awaitingDelivery: number;
    recentPurchases: {
      poId: number;
      poNo: string;
      grandTotal: number;
      status: string;
      createdAt: string;
    }[];
    purchaseTrend: { date: string; count: number; totalValue: number }[];
  };
  receivingSummary: {
    todayCount: number;
  };
  employeeSummary: {
    totalActive: number;
    onLeaveOrInactive: number;
  };
  attendanceSummary: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onShiftNow: number;
  };
  staffOnDuty: { employeeId: number; employeeName: string; clockIn: string }[];
  recentAuditActivity: {
    id: number;
    action: string;
    entityType: string;
    entityId: string | null;
    userId: number | null;
    createdAt: string;
  }[];
  loyaltySummary: {
    activeAccounts: number;
    totalPointsOutstanding: number;
    pointsEarnedInPeriod: number;
    pointsRedeemedInPeriod: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(KitchenTicket)
    private readonly kitchenTicketsRepository: Repository<KitchenTicket>,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getSummary(query: DashboardQueryDto): Promise<DashboardSummary> {
    const range = this.resolveRange(query);
    const cacheKey = `dashboard:summary:${range.outletId ?? 'all'}:${range.from.toISOString()}:${range.to.toISOString()}`;

    return this.cache.wrap(
      cacheKey,
      async () => {
        const [
          salesOverview,
          revenueTrend,
          ordersOverview,
          activeTableSessions,
          reservationsSummary,
          kitchenOverview,
          inventoryOverview,
          wastageSummary,
          paymentBreakdown,
          bestSellingFoods,
          recentActivity,
        ] = await Promise.all([
          this.getSalesOverview(range),
          this.getRevenueTrend(range),
          this.getOrdersOverview(range),
          this.getActiveTableSessions(range),
          this.getReservationsSummary(range),
          this.getKitchenOverview(range),
          this.getInventoryOverview(range),
          this.getWastageSummary(range),
          this.getPaymentBreakdown(range),
          this.getBestSellingFoods(range),
          this.getRecentActivity(range),
        ]);

        const [
          supplierSummary,
          purchaseSummary,
          receivingSummary,
          employeeSummary,
          attendanceSummary,
          staffOnDuty,
          recentAuditActivity,
        ] = await Promise.all([
          this.getSupplierSummary(range),
          this.getPurchaseSummary(range),
          this.getReceivingSummary(range),
          this.getEmployeeSummary(range),
          this.getAttendanceSummary(range),
          this.getStaffOnDuty(range),
          this.getRecentAuditActivity(),
        ]);

        const [loyaltySummary] = await Promise.all([
          this.getLoyaltySummary(range),
        ]);

        return {
          salesOverview,
          revenueTrend,
          ordersOverview,
          activeTableSessions,
          reservationsSummary,
          kitchenOverview,
          inventoryOverview,
          wastageSummary,
          paymentBreakdown,
          bestSellingFoods,
          recentActivity,
          supplierSummary,
          purchaseSummary,
          receivingSummary,
          employeeSummary,
          attendanceSummary,
          staffOnDuty,
          recentAuditActivity,
          loyaltySummary,
        };
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
      .where('ingredient.is_active = true')
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
        .where('ingredient.is_active = true')
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
      qb.andWhere('payment.outlet_id = :outletId', {
        outletId: range.outletId,
      });
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

  private async getSupplierSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['supplierSummary']> {
    const baseQb = () => {
      const qb = this.ordersRepository.manager
        .createQueryBuilder()
        .from('suppliers', 'supplier')
        .where("supplier.status = 'active'");
      if (range.outletId !== undefined) {
        qb.andWhere('supplier.outlet_id = :outletId', {
          outletId: range.outletId,
        });
      }
      return qb;
    };

    const [activeCount, totals, overLimit, topSuppliers] = await Promise.all([
      baseQb().getCount(),
      baseQb()
        .select(
          'COALESCE(SUM(supplier.outstanding_balance), 0)',
          'totalOutstanding',
        )
        .getRawOne<{ totalOutstanding: string }>(),
      baseQb()
        .andWhere('supplier.credit_limit > 0')
        .andWhere('supplier.outstanding_balance > supplier.credit_limit')
        .getCount(),
      baseQb()
        .select('supplier.id', 'supplierId')
        .addSelect('supplier.company_name', 'companyName')
        .addSelect('supplier.outstanding_balance', 'outstandingBalance')
        .orderBy('supplier.outstanding_balance', 'DESC')
        .limit(5)
        .getRawMany<{
          supplierId: number;
          companyName: string;
          outstandingBalance: string;
        }>(),
    ]);

    return {
      activeCount,
      totalOutstanding: Number(totals?.totalOutstanding ?? 0),
      overCreditLimitCount: overLimit,
      topSuppliers: topSuppliers.map((row) => ({
        supplierId: Number(row.supplierId),
        companyName: row.companyName,
        outstandingBalance: Number(row.outstandingBalance),
      })),
    };
  }

  private async getPurchaseSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['purchaseSummary']> {
    const baseQb = () => {
      const qb = this.ordersRepository.manager
        .createQueryBuilder()
        .from('purchase_orders', 'po');
      if (range.outletId !== undefined) {
        qb.andWhere('po.outlet_id = :outletId', { outletId: range.outletId });
      }
      return qb;
    };

    const [pendingApproval, approved, awaitingDelivery, recentRows, trendRows] =
      await Promise.all([
        baseQb().andWhere("po.status = 'pending_approval'").getCount(),
        baseQb().andWhere("po.status = 'approved'").getCount(),
        baseQb()
          .andWhere("po.status IN ('approved', 'partially_received')")
          .getCount(),
        baseQb()
          .select('po.id', 'poId')
          .addSelect('po.po_no', 'poNo')
          .addSelect('po.grand_total', 'grandTotal')
          .addSelect('po.status', 'status')
          .addSelect('po.created_at', 'createdAt')
          .orderBy('po.created_at', 'DESC')
          .limit(10)
          .getRawMany<{
            poId: number;
            poNo: string;
            grandTotal: string;
            status: string;
            createdAt: string;
          }>(),
        baseQb()
          .select("TO_CHAR(po.created_at, 'YYYY-MM-DD')", 'date')
          .addSelect('COUNT(*)', 'count')
          .addSelect('COALESCE(SUM(po.grand_total), 0)', 'totalValue')
          .andWhere('po.created_at BETWEEN :from AND :to', {
            from: range.from,
            to: range.to,
          })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany<{ date: string; count: string; totalValue: string }>(),
      ]);

    return {
      pendingApproval,
      approved,
      awaitingDelivery,
      recentPurchases: recentRows.map((row) => ({
        poId: Number(row.poId),
        poNo: row.poNo,
        grandTotal: Number(row.grandTotal),
        status: row.status,
        createdAt: row.createdAt,
      })),
      purchaseTrend: trendRows.map((row) => ({
        date: row.date,
        count: Number(row.count),
        totalValue: Number(row.totalValue),
      })),
    };
  }

  private async getReceivingSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['receivingSummary']> {
    const today = new Date().toISOString().slice(0, 10);
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('goods_receivings', 'grn')
      .where('grn.received_date = :today', { today });
    if (range.outletId !== undefined) {
      qb.andWhere('grn.outlet_id = :outletId', { outletId: range.outletId });
    }
    const row = await qb.getRawOne<{ count: string }>();
    return { todayCount: Number(row?.count ?? 0) };
  }

  private async getEmployeeSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['employeeSummary']> {
    const baseQb = () => {
      const qb = this.ordersRepository.manager
        .createQueryBuilder()
        .from('employees', 'employee');
      if (range.outletId !== undefined) {
        qb.andWhere('employee.outlet_id = :outletId', {
          outletId: range.outletId,
        });
      }
      return qb;
    };
    const [totalActive, onLeaveOrInactive] = await Promise.all([
      baseQb().andWhere("employee.employment_status = 'active'").getCount(),
      baseQb().andWhere("employee.employment_status != 'active'").getCount(),
    ]);
    return { totalActive, onLeaveOrInactive };
  }

  private async getAttendanceSummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['attendanceSummary']> {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    const baseQb = () => {
      const qb = this.ordersRepository.manager
        .createQueryBuilder()
        .from('attendance', 'attendance')
        .where('attendance.clock_in >= :start', { start })
        .andWhere('attendance.clock_in < :end', { end });
      if (range.outletId !== undefined) {
        qb.andWhere('attendance.outlet_id = :outletId', {
          outletId: range.outletId,
        });
      }
      return qb;
    };

    const [presentToday, lateToday, onShiftNow, totalEmployees] =
      await Promise.all([
        baseQb()
          .andWhere("attendance.status IN ('present', 'late')")
          .getCount(),
        baseQb().andWhere('attendance.is_late = true').getCount(),
        baseQb().andWhere('attendance.clock_out IS NULL').getCount(),
        this.getEmployeeSummary(range).then((s) => s.totalActive),
      ]);

    return {
      presentToday,
      absentToday: Math.max(0, totalEmployees - presentToday),
      lateToday,
      onShiftNow,
    };
  }

  private async getStaffOnDuty(
    range: ResolvedRange,
  ): Promise<DashboardSummary['staffOnDuty']> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('attendance.employee_id', 'employeeId')
      .addSelect('user.name', 'employeeName')
      .addSelect('attendance.clock_in', 'clockIn')
      .from('attendance', 'attendance')
      .innerJoin(
        'employees',
        'employee',
        'employee.id = attendance.employee_id',
      )
      .innerJoin('users','user','user.id = employee.user_id')
      .where('attendance.clock_out IS NULL')
      .orderBy('attendance.clock_in', 'DESC')
      .limit(20);
    if (range.outletId !== undefined) {
      qb.andWhere('attendance.outlet_id = :outletId', {
        outletId: range.outletId,
      });
    }
    const rows = await qb.getRawMany<{
      employeeId: number;
      employeeName: string;
      clockIn: string;
    }>();
    return rows.map((row) => ({
      employeeId: Number(row.employeeId),
      employeeName: row.employeeName,
      clockIn: row.clockIn,
    }));
  }

  private async getRecentAuditActivity(): Promise<
    DashboardSummary['recentAuditActivity']
  > {
    const rows = await this.ordersRepository.manager
      .createQueryBuilder()
      .select('a.id', 'id')
      .addSelect('a.action', 'action')
      .addSelect('a.entity_type', 'entityType')
      .addSelect('a.entity_id', 'entityId')
      .addSelect('a.user_id', 'userId')
      .addSelect('a.created_at', 'createdAt')
      .from('audit_logs', 'a')
      .orderBy('a.created_at', 'DESC')
      .limit(10)
      .getRawMany<{
        id: number;
        action: string;
        entityType: string;
        entityId: string | null;
        userId: number | null;
        createdAt: string;
      }>();
    return rows.map((row) => ({
      id: Number(row.id),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      userId: row.userId !== null ? Number(row.userId) : null,
      createdAt: row.createdAt,
    }));
  }

  private async getLoyaltySummary(
    range: ResolvedRange,
  ): Promise<DashboardSummary['loyaltySummary']> {
    const [accountTotals, periodTotals] = await Promise.all([
      this.ordersRepository.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'activeAccounts')
        .addSelect('COALESCE(SUM(account.current_points), 0)', 'totalPointsOutstanding')
        .from('loyalty_accounts', 'account')
        .where('account.current_points > 0')
        .getRawOne<{ activeAccounts: string; totalPointsOutstanding: string }>(),
      this.ordersRepository.manager
        .createQueryBuilder()
        .select(
          "COALESCE(SUM(t.points) FILTER (WHERE t.type = 'earn'), 0)",
          'pointsEarned',
        )
        .addSelect(
          "COALESCE(SUM(ABS(t.points)) FILTER (WHERE t.type = 'redeem'), 0)",
          'pointsRedeemed',
        )
        .from('loyalty_transactions', 't')
        .where('t.created_at BETWEEN :from AND :to', {
          from: range.from,
          to: range.to,
        })
        .getRawOne<{ pointsEarned: string; pointsRedeemed: string }>(),
    ]);

    return {
      activeAccounts: Number(accountTotals?.activeAccounts ?? 0),
      totalPointsOutstanding: Number(accountTotals?.totalPointsOutstanding ?? 0),
      pointsEarnedInPeriod: Number(periodTotals?.pointsEarned ?? 0),
      pointsRedeemedInPeriod: Number(periodTotals?.pointsRedeemed ?? 0),
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
