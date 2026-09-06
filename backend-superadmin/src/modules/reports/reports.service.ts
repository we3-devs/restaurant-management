import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { Order } from '../orders/entities/order.entity';
import { ListReportQueryDto } from './dto/list-report-query.dto';
import { REPORT_TYPES, type ReportType } from './report-columns';
import { SettingsService } from '../settings/settings.service';
import { businessDateRange } from '../../common/reporting/reporting-date.util';

const DEFAULT_RANGE_DAYS = 30;
const EXPORT_ROW_CAP = 5000;

interface ResolvedQuery {
  /**
   * Effective outlet restriction after intersecting the requested outletId
   * (if any) with the caller's accessible outlets. undefined means
   * unrestricted (superadmin with no explicit outletId filter); an empty
   * array means the caller has no accessible outlets and must get zero rows.
   */
  outletIds?: number[];
  from: Date;
  to: Date;
  search?: string;
  credited?: boolean;
  sortDir: 'ASC' | 'DESC';
  page: number;
  limit: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly settings: SettingsService,
  ) {}

  private async resolve(
    query: ListReportQueryDto,
    accessibleOutletIds: number[] | 'ALL',
    forExport = false,
  ): Promise<ResolvedQuery> {
    const business = await this.settings.getBusinessSettings();
    const timezone = typeof business.timezone === 'string' && business.timezone ? business.timezone : undefined;
    const { from, to } = businessDateRange(query.dateFrom, query.dateTo, timezone);
    let outletIds: number[] | undefined;
    if (query.outletId !== undefined) {
      outletIds = [query.outletId];
    } else if (accessibleOutletIds !== 'ALL') {
      outletIds = accessibleOutletIds;
    }
    return {
      outletIds,
      from,
      to,
      search: query.search,
      credited: query.credited,
      sortDir: query.sortDir === 'ASC' ? 'ASC' : 'DESC',
      page: forExport ? 1 : query.page,
      limit: forExport ? EXPORT_ROW_CAP : query.limit,
    };
  }

  /**
   * accessibleOutletIds must come from OutletAccessService, computed from
   * the authenticated caller — the controller has already asserted access
   * to query.outletId when it's explicitly provided. This is what keeps
   * outlet-scoped staff from reading other outlets' report data.
   */
  async getReport(
    type: ReportType,
    query: ListReportQueryDto,
    accessibleOutletIds: number[] | 'ALL',
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    if (!REPORT_TYPES.includes(type)) {
      throw new BadRequestException(`Unknown report type "${type}"`);
    }
    const resolved = await this.resolve(query, accessibleOutletIds);
    return this.run(type, resolved);
  }

  /** Uncapped-but-bounded row set for export — same filters, no UI pagination. */
  async getReportRowsForExport(
    type: ReportType,
    query: ListReportQueryDto,
    accessibleOutletIds: number[] | 'ALL',
  ): Promise<Record<string, unknown>[]> {
    if (!REPORT_TYPES.includes(type)) {
      throw new BadRequestException(`Unknown report type "${type}"`);
    }
    const resolved = await this.resolve(query, accessibleOutletIds, true);
    const result = await this.run(type, resolved);
    return result.data;
  }

  private async run(
    type: ReportType,
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    if (resolved.outletIds !== undefined && resolved.outletIds.length === 0) {
      return { data: [], meta: this.meta(resolved.page, resolved.limit, 0) };
    }
    switch (type) {
      case 'sales':
        return this.salesReport(resolved);
      case 'sales-items':
        return this.salesItemsReport(resolved);
      case 'orders':
        return this.ordersReport(resolved);
      case 'inventory':
        return this.inventoryReport(resolved);
      case 'stock-movements':
        return this.stockMovementsReport(resolved);
      case 'ingredient-consumption':
        return this.ingredientConsumptionReport(resolved);
      case 'wastage':
        return this.wastageReport(resolved);
      case 'kitchen-performance':
        return this.kitchenPerformanceReport(resolved);
      case 'reservations':
        return this.reservationsReport(resolved);
      case 'customers':
        return this.customersReport(resolved);
      case 'payments':
        return this.paymentsReport(resolved);
      case 'suppliers':
        return this.suppliersReport(resolved);
      case 'purchase-orders':
        return this.purchaseOrdersReport(resolved);
      case 'goods-receiving':
        return this.goodsReceivingReport(resolved);
      case 'purchase-returns':
        return this.purchaseReturnsReport(resolved);
      case 'supplier-payments':
        return this.supplierPaymentsReport(resolved);
      case 'employees':
        return this.employeesReport(resolved);
      case 'attendance':
        return this.attendanceReport(resolved);
      case 'shifts':
        return this.shiftsReport(resolved);
      case 'staff-performance':
        return this.staffPerformanceReport(resolved);
      case 'payroll-export':
        return this.payrollExportReport(resolved);
      case 'settings-changes':
        return this.settingsChangesReport(resolved);
      case 'audit-logs':
        return this.auditLogsReport(resolved);
      case 'loyalty-top-customers':
        return this.loyaltyTopCustomersReport(resolved);
      case 'loyalty-points-earned':
        return this.loyaltyPointsEarnedReport(resolved);
      case 'loyalty-points-redeemed':
        return this.loyaltyPointsRedeemedReport(resolved);
      case 'loyalty-outstanding':
        return this.loyaltyOutstandingReport(resolved);
      case 'loyalty-transactions':
        return this.loyaltyTransactionsReport(resolved);
    }
  }

  private meta(page: number, limit: number, total: number) {
    return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }

  private async paginateRaw(
    qb: ReturnType<Repository<Order>['manager']['createQueryBuilder']>,
    resolved: ResolvedQuery,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const total = await qb.getCount();
    const data = await qb
      .offset((resolved.page - 1) * resolved.limit)
      .limit(resolved.limit)
      .getRawMany<Record<string, unknown>>();
    return { data, total };
  }

  private async salesReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('order.order_number', 'orderNumber')
      .addSelect(`TO_CHAR(order.created_at, 'YYYY-MM-DD"T"HH24:MI:SS')`, 'createdAt')
      .addSelect('order.subtotal', 'subtotal')
      .addSelect('order.discount_amount', 'discountAmount')
      .addSelect('order.tax_amount', 'taxAmount')
      .addSelect('order.service_charge_amount', 'serviceChargeAmount')
      .addSelect('order.grand_total', 'grandTotal')
      .addSelect('order.payment_status', 'paymentStatus')
      .from('orders', 'order')
      .where("order.status != 'cancelled'")
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('order.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('order.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('order.order_number ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async salesItemsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const creditedSql = `EXISTS (SELECT 1 FROM customer_credit_transactions credit WHERE credit.order_id = order.id AND credit.type = 'charge')`;
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .addSelect("COALESCE(food_variant.name, food.name)", 'itemName')
      .addSelect('SUM(item.quantity)', 'quantity')
      .addSelect('SUM(item.total_amount) / NULLIF(SUM(item.quantity), 0)', 'unitCost')
      .addSelect('SUM(item.total_amount)', 'totalCost')
      // Allocate an order's actual paid ratio across its items. This keeps
      // unpaid/partial orders out of Paid instead of assuming every
      // non-credit order is fully settled.
      .addSelect(`SUM(item.total_amount * CASE
        WHEN order.grand_total <= 0 THEN 0
        ELSE LEAST(1, GREATEST(0, order.paid_amount / order.grand_total))
      END)`, 'paid')
      .addSelect(`SUM(item.total_amount * CASE
        WHEN order.grand_total <= 0 THEN 1
        ELSE 1 - LEAST(1, GREATEST(0, order.paid_amount / order.grand_total))
      END)`, 'notPaid')
      .from('order_items', 'item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .innerJoin('foods', 'food', 'food.id = item.food_id')
      .leftJoin('food_variants', 'food_variant', 'food_variant.id = item.food_variant_id')
      .where("order.status != 'cancelled'")
      .andWhere("item.status != 'cancelled'")
      .andWhere('order.created_at BETWEEN :from AND :to', { from: resolved.from, to: resolved.to })
      .groupBy("COALESCE(food_variant.name, food.name)")
      .orderBy('"totalCost"', resolved.sortDir);
    if (resolved.outletIds !== undefined) qb.andWhere('order.outlet_id IN (:...outletIds)', { outletIds: resolved.outletIds });
    if (resolved.search) qb.andWhere('(order.order_number ILIKE :search OR food.name ILIKE :search)', { search: `%${resolved.search}%` });
    if (resolved.credited !== undefined) qb.andWhere(`${creditedSql} = :credited`, { credited: resolved.credited });
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async ordersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('order.order_number', 'orderNumber')
      .addSelect(`TO_CHAR(order.created_at, 'YYYY-MM-DD"T"HH24:MI:SS')`, 'createdAt')
      .addSelect('order.order_type', 'orderType')
      .addSelect('order.source', 'source')
      .addSelect('order.status', 'status')
      .addSelect(
        '(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = order.id)',
        'itemCount',
      )
      .from('orders', 'order')
      .where('order.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('order.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('order.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('order.order_number ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async inventoryReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('ingredient.name', 'ingredientName')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('stock.quantity', 'quantity')
      .addSelect('ingredient.reorder_level', 'reorderLevel')
      .addSelect('ingredient.minimum_stock', 'minimumStock')
      .addSelect('stock.stock_value', 'stockValue')
      .from('warehouse_ingredient_stocks', 'stock')
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = stock.ingredient_id',
      )
      .innerJoin('warehouses', 'warehouse', 'warehouse.id = stock.warehouse_id')
      .where('ingredient.is_active = true')
      .orderBy('ingredient.name', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('warehouse.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('ingredient.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  /**
   * TypeORM's QueryBuilder.from() can't target a raw UNION ALL derived
   * table (it tries to resolve "doc" as entity metadata), so this one report
   * runs as hand-built parameterized SQL via manager.query() instead of the
   * QueryBuilder used everywhere else in this file.
   */
  private async stockMovementsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const union = `
      SELECT 'stock_in' AS movement_type, doc.stock_in_no AS document_no, doc.stock_in_date AS date, doc.status AS status, doc.warehouse_id AS warehouse_id
      FROM ingredient_stock_ins doc
      UNION ALL
      SELECT 'stock_out', doc.stock_out_no, doc.stock_out_date, doc.status, doc.warehouse_id
      FROM ingredient_stock_outs doc
      UNION ALL
      SELECT 'transfer', doc.transfer_no, doc.transfer_date, doc.status, doc.from_warehouse_id
      FROM ingredient_stock_transfers doc
      UNION ALL
      SELECT 'adjustment', doc.adjustment_no, doc.adjustment_date, doc.status, doc.warehouse_id
      FROM ingredient_stock_adjustments doc
      UNION ALL
      SELECT 'wastage', doc.wastage_no, doc.wastage_date, doc.status, doc.warehouse_id
      FROM ingredient_wastages doc
      UNION ALL
      SELECT 'count', doc.count_no, doc.count_date, doc.status, doc.warehouse_id
      FROM ingredient_stock_counts doc
    `;

    const params: unknown[] = [resolved.from, resolved.to];
    let where = 'doc.date BETWEEN $1 AND $2';
    if (resolved.outletIds !== undefined) {
      params.push(resolved.outletIds);
      where += ` AND warehouse.outlet_id = ANY($${params.length})`;
    }
    if (resolved.search) {
      params.push(`%${resolved.search}%`);
      where += ` AND doc.document_no ILIKE $${params.length}`;
    }

    const baseFrom = `
      FROM (${union}) doc
      INNER JOIN warehouses warehouse ON warehouse.id = doc.warehouse_id
      WHERE ${where}
    `;

    const countRows = await this.ordersRepository.manager.query<
      { count: string }[]
    >(`SELECT COUNT(*) AS count ${baseFrom}`, params);
    const total = Number(countRows[0]?.count ?? 0);

    const dataParams = [
      ...params,
      resolved.limit,
      (resolved.page - 1) * resolved.limit,
    ];
    const data = await this.ordersRepository.manager.query<
      Record<string, unknown>[]
    >(
      `SELECT doc.movement_type AS "movementType", doc.document_no AS "documentNo", doc.date AS "date", doc.status AS "status", warehouse.name AS "warehouseName"
       ${baseFrom}
       ORDER BY doc.date ${resolved.sortDir}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async ingredientConsumptionReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('ingredient.name', 'ingredientName')
      .addSelect(
        'COALESCE(SUM(reservation.consumed_quantity), 0)',
        'totalConsumed',
      )
      .addSelect('COUNT(DISTINCT "order".id)', 'orderCount')
      .from('order_item_ingredient_reservations', 'reservation')
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = reservation.ingredient_id',
      )
      .innerJoin('order_items', 'item', 'item.id = reservation.order_item_id')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .where('"order".created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .groupBy('ingredient.name')
      .orderBy('"totalConsumed"', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('"order".outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('ingredient.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async wastageReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('wastage.wastage_date', 'wastageDate')
      .addSelect('ingredient.name', 'ingredientName')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('item.quantity', 'quantity')
      .addSelect('item.unit_cost', 'unitCost')
      .addSelect('item.total_cost', 'totalCost')
      .addSelect('wastage.reason', 'reason')
      .from('ingredient_wastage_items', 'item')
      .innerJoin(
        'ingredient_wastages',
        'wastage',
        'wastage.id = item.ingredient_wastage_id',
      )
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = item.ingredient_id',
      )
      .innerJoin(
        'warehouses',
        'warehouse',
        'warehouse.id = wastage.warehouse_id',
      )
      .where('wastage.wastage_date BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('wastage.wastage_date', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('warehouse.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('ingredient.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async kitchenPerformanceReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('ticket.id', 'ticketId')
      .addSelect('"order".order_number', 'orderNumber')
      .addSelect('department.name', 'departmentName')
      .addSelect('ticket.priority', 'priority')
      .addSelect('ticket.created_at', 'createdAt')
      .addSelect(
        'ROUND(EXTRACT(EPOCH FROM (ticket.ready_at - ticket.started_at)) / 60, 1)',
        'prepMinutes',
      )
      .addSelect('ticket.recall_count', 'recallCount')
      .from('kitchen_tickets', 'ticket')
      .innerJoin('orders', 'order', '"order".id = ticket.order_id')
      .leftJoin(
        'outlet_departments',
        'department',
        'department.id = ticket.department_id',
      )
      .where('ticket.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('ticket.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('ticket.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('"order".order_number ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async reservationsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('reservation.reserved_at', 'reservedAt')
      .addSelect('customer.name', 'customerName')
      .addSelect('reservation.guest_count', 'guestCount')
      .addSelect('reservation.status', 'status')
      .addSelect('reservation.source', 'source')
      .from('reservations', 'reservation')
      .innerJoin(
        'customers',
        'customer',
        'customer.id = reservation.customer_id',
      )
      .where('reservation.reserved_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('reservation.reserved_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('reservation.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async customersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const outletFilter =
      resolved.outletIds !== undefined
        ? 'AND "order".outlet_id IN (:...outletIds)'
        : '';
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('customer.name', 'name')
      .addSelect('customer.phone', 'phone')
      .addSelect('COUNT("order".id)', 'orderCount')
      .addSelect('COALESCE(SUM("order".grand_total), 0)', 'totalSpent')
      .addSelect('MAX("order".created_at)', 'lastOrderAt')
      .from('customers', 'customer')
      .innerJoin(
        'orders',
        'order',
        `"order".customer_id = customer.id AND "order".created_at BETWEEN :from AND :to AND "order".status != 'cancelled' ${outletFilter}`,
        {
          from: resolved.from,
          to: resolved.to,
          outletIds: resolved.outletIds ?? [],
        },
      )
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .addGroupBy('customer.phone')
      .orderBy('"totalSpent"', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async paymentsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('payment.payment_number', 'paymentNumber')
      .addSelect('"order".order_number', 'orderNumber')
      .addSelect('payment.method', 'method')
      .addSelect('payment.type', 'type')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.status', 'status')
      .addSelect('payment.paid_at', 'paidAt')
      .from('order_payments', 'payment')
      .innerJoin('orders', 'order', '"order".id = payment.order_id')
      .where('payment.paid_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('payment.paid_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('payment.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('"order".order_number ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async suppliersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('supplier.supplier_no', 'supplierNo')
      .addSelect('supplier.company_name', 'companyName')
      .addSelect('supplier.contact_person', 'contactPerson')
      .addSelect('supplier.phone', 'phone')
      .addSelect('supplier.status', 'status')
      .addSelect('supplier.outstanding_balance', 'outstandingBalance')
      .addSelect('supplier.credit_limit', 'creditLimit')
      .from('suppliers', 'supplier')
      .where('supplier.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('supplier.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('supplier.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('supplier.company_name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async purchaseOrdersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('po.po_no', 'poNo')
      .addSelect('supplier.company_name', 'supplierName')
      .addSelect('outlet.name', 'outletName')
      .addSelect('po.status', 'status')
      .addSelect('po.expected_delivery_date', 'expectedDeliveryDate')
      .addSelect('po.grand_total', 'grandTotal')
      .addSelect('po.created_at', 'createdAt')
      .from('purchase_orders', 'po')
      .innerJoin('suppliers', 'supplier', 'supplier.id = po.supplier_id')
      .innerJoin('outlets', 'outlet', 'outlet.id = po.outlet_id')
      .where('po.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('po.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('po.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('po.po_no ILIKE :search', { search: `%${resolved.search}%` });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async goodsReceivingReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('grn.grn_no', 'grnNo')
      .addSelect('po.po_no', 'poNo')
      .addSelect('supplier.company_name', 'supplierName')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('grn.received_date', 'receivedDate')
      .addSelect('grn.status', 'status')
      .from('goods_receivings', 'grn')
      .innerJoin('purchase_orders', 'po', 'po.id = grn.purchase_order_id')
      .innerJoin('suppliers', 'supplier', 'supplier.id = grn.supplier_id')
      .innerJoin('warehouses', 'warehouse', 'warehouse.id = grn.warehouse_id')
      .where('grn.received_date BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('grn.received_date', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('grn.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('grn.grn_no ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async purchaseReturnsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('pr.return_no', 'returnNo')
      .addSelect('supplier.company_name', 'supplierName')
      .addSelect('pr.return_date', 'returnDate')
      .addSelect('pr.refund_type', 'refundType')
      .addSelect('pr.status', 'status')
      .addSelect(
        '(SELECT COALESCE(SUM(item.total_cost), 0) FROM purchase_return_items item WHERE item.purchase_return_id = pr.id)',
        'totalCost',
      )
      .from('purchase_returns', 'pr')
      .innerJoin('suppliers', 'supplier', 'supplier.id = pr.supplier_id')
      .where('pr.return_date BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('pr.return_date', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('pr.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('pr.return_no ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async supplierPaymentsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('payment.payment_no', 'paymentNo')
      .addSelect('supplier.company_name', 'supplierName')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.payment_method', 'paymentMethod')
      .addSelect('payment.status', 'status')
      .addSelect('payment.created_at', 'createdAt')
      .from('supplier_payments', 'payment')
      .innerJoin('suppliers', 'supplier', 'supplier.id = payment.supplier_id')
      .where('payment.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('payment.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('payment.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('payment.payment_no ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async employeesReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('employee.employee_code', 'employeeCode')
      .addSelect('employee.name', 'name')
      .addSelect('position.name', 'positionName')
      .addSelect('outlet.name', 'outletName')
      .addSelect('employee.employment_status', 'employmentStatus')
      .addSelect('employee.joining_date', 'joiningDate')
      .from('employees', 'employee')
      .leftJoin('positions', 'position', 'position.id = employee.position_id')
      .innerJoin('outlets', 'outlet', 'outlet.id = employee.outlet_id')
      .where('employee.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('employee.created_at', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('employee.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('employee.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async attendanceReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('employee.name', 'employeeName')
      .addSelect('outlet.name', 'outletName')
      .addSelect('attendance.clock_in', 'clockIn')
      .addSelect('attendance.clock_out', 'clockOut')
      .addSelect('attendance.status', 'status')
      .addSelect('attendance.late_minutes', 'lateMinutes')
      .addSelect('attendance.working_hours', 'workingHours')
      .from('attendance', 'attendance')
      .innerJoin(
        'employees',
        'employee',
        'employee.id = attendance.employee_id',
      )
      .innerJoin('outlets', 'outlet', 'outlet.id = attendance.outlet_id')
      .where('attendance.clock_in BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('attendance.clock_in', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('attendance.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('employee.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async shiftsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('shift.name', 'name')
      .addSelect('outlet.name', 'outletName')
      .addSelect('shift.start_time', 'startTime')
      .addSelect('shift.end_time', 'endTime')
      .addSelect('shift.working_hours', 'workingHours')
      .addSelect(
        '(SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = shift.id AND sa.is_active = true)',
        'assignedCount',
      )
      .from('shifts', 'shift')
      .innerJoin('outlets', 'outlet', 'outlet.id = shift.outlet_id')
      .where('shift.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('shift.start_time', resolved.sortDir);
    if (resolved.outletIds !== undefined) {
      qb.andWhere('shift.outlet_id IN (:...outletIds)', {
        outletIds: resolved.outletIds,
      });
    }
    if (resolved.search) {
      qb.andWhere('shift.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async staffPerformanceReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const outletFilter =
      resolved.outletIds !== undefined
        ? 'AND employee.outlet_id IN (:...outletIds)'
        : '';
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('employee.name', 'employeeName')
      .addSelect(
        `(SELECT COUNT(*) FROM order_assignments oa WHERE oa.employee_id = employee.id AND oa.assigned_at BETWEEN :from AND :to)`,
        'ordersServed',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM table_assignments ta WHERE ta.employee_id = employee.id AND ta.assigned_at BETWEEN :from AND :to)`,
        'tablesServed',
      )
      .addSelect(
        `(SELECT COALESCE(SUM("order".grand_total), 0) FROM order_assignments oa INNER JOIN orders "order" ON "order".id = oa.order_id WHERE oa.employee_id = employee.id AND oa.assigned_at BETWEEN :from AND :to)`,
        'salesGenerated',
      )
      .addSelect(
        `(SELECT ROUND(AVG(EXTRACT(EPOCH FROM (oa.served_at - oa.assigned_at)) / 60), 1) FROM order_assignments oa WHERE oa.employee_id = employee.id AND oa.served_at IS NOT NULL AND oa.assigned_at BETWEEN :from AND :to)`,
        'avgServiceMinutes',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(a.working_hours), 0) FROM attendance a WHERE a.employee_id = employee.id AND a.clock_in BETWEEN :from AND :to)`,
        'workingHours',
      )
      .addSelect(
        `(SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1) FROM attendance a WHERE a.employee_id = employee.id AND a.clock_in BETWEEN :from AND :to)`,
        'attendancePercent',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM attendance a WHERE a.employee_id = employee.id AND a.is_late = true AND a.clock_in BETWEEN :from AND :to)`,
        'lateCount',
      )
      .from('employees', 'employee')
      .where(`employee.created_at <= :to ${outletFilter}`, {
        from: resolved.from,
        to: resolved.to,
        outletIds: resolved.outletIds ?? [],
      })
      .orderBy('"salesGenerated"', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('employee.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return {
      data,
      meta: this.meta(resolved.page, resolved.limit, total),
    };
  }

  /** Payroll export is a CSV-only worked-hours/attendance extract — no pay-rate or deduction calculations. */
  private async payrollExportReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const outletFilter =
      resolved.outletIds !== undefined
        ? 'AND employee.outlet_id IN (:...outletIds)'
        : '';
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('employee.employee_code', 'employeeCode')
      .addSelect('employee.name', 'name')
      .addSelect('position.name', 'positionName')
      .addSelect('employee.employment_status', 'employmentStatus')
      .addSelect(
        `(SELECT COUNT(*) FROM attendance a WHERE a.employee_id = employee.id AND a.status IN ('present', 'late') AND a.clock_in BETWEEN :from AND :to)`,
        'presentDays',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM attendance a WHERE a.employee_id = employee.id AND a.is_late = true AND a.clock_in BETWEEN :from AND :to)`,
        'lateDays',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(a.working_hours), 0) FROM attendance a WHERE a.employee_id = employee.id AND a.clock_in BETWEEN :from AND :to)`,
        'workingHours',
      )
      .from('employees', 'employee')
      .leftJoin('positions', 'position', 'position.id = employee.position_id')
      .where(`employee.created_at <= :to ${outletFilter}`, {
        from: resolved.from,
        to: resolved.to,
        outletIds: resolved.outletIds ?? [],
      })
      .orderBy('employee.name', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('employee.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async settingsChangesReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('setting.category', 'category')
      .addSelect('"user".name', 'updatedBy')
      .addSelect('setting.updated_at', 'updatedAt')
      .from('global_settings', 'setting')
      .leftJoin('users', 'user', '"user".id = setting.updated_by_user_id')
      .where('setting.updated_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('setting.updated_at', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('setting.category ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async auditLogsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('log.action', 'action')
      .addSelect('log.entity_type', 'entityType')
      .addSelect('log.entity_id', 'entityId')
      .addSelect('log.user_id', 'userId')
      .addSelect('log.created_at', 'createdAt')
      .from('audit_logs', 'log')
      .where('log.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('log.created_at', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('(log.entity_type ILIKE :search OR log.entity_id ILIKE :search)', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async loyaltyTopCustomersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('customer.name', 'customerName')
      .addSelect('account.current_points', 'currentPoints')
      .addSelect('account.lifetime_earned', 'lifetimeEarned')
      .addSelect('account.lifetime_redeemed', 'lifetimeRedeemed')
      .from('loyalty_accounts', 'account')
      .innerJoin('customers', 'customer', 'customer.id = account.customer_id')
      .orderBy('account.current_points', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async loyaltyPointsEarnedReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('t.created_at', 'date')
      .addSelect('customer.name', 'customerName')
      .addSelect('t.points', 'points')
      .addSelect('t.source', 'source')
      .addSelect('"order".order_number', 'orderNumber')
      .from('loyalty_transactions', 't')
      .innerJoin('customers', 'customer', 'customer.id = t.customer_id')
      .leftJoin('orders', 'order', '"order".id = t.order_id')
      .where("t.type = 'earn'")
      .andWhere('t.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('t.created_at', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async loyaltyPointsRedeemedReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('t.created_at', 'date')
      .addSelect('customer.name', 'customerName')
      .addSelect('t.points', 'points')
      .addSelect('t.source', 'source')
      .addSelect('"order".order_number', 'orderNumber')
      .from('loyalty_transactions', 't')
      .innerJoin('customers', 'customer', 'customer.id = t.customer_id')
      .leftJoin('orders', 'order', '"order".id = t.order_id')
      .where("t.type = 'redeem'")
      .andWhere('t.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('t.created_at', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async loyaltyOutstandingReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('customer.name', 'customerName')
      .addSelect('account.current_points', 'currentPoints')
      .addSelect('account.expiring_points', 'expiringPoints')
      .from('loyalty_accounts', 'account')
      .innerJoin('customers', 'customer', 'customer.id = account.customer_id')
      .where('account.current_points > 0')
      .orderBy('account.current_points', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }

  private async loyaltyTransactionsReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('t.created_at', 'date')
      .addSelect('customer.name', 'customerName')
      .addSelect('t.type', 'type')
      .addSelect('t.points', 'points')
      .addSelect('t.balance_after', 'balanceAfter')
      .addSelect('t.source', 'source')
      .from('loyalty_transactions', 't')
      .innerJoin('customers', 'customer', 'customer.id = t.customer_id')
      .where('t.created_at BETWEEN :from AND :to', {
        from: resolved.from,
        to: resolved.to,
      })
      .orderBy('t.created_at', resolved.sortDir);
    if (resolved.search) {
      qb.andWhere('customer.name ILIKE :search', {
        search: `%${resolved.search}%`,
      });
    }
    const { data, total } = await this.paginateRaw(qb, resolved);
    return { data, meta: this.meta(resolved.page, resolved.limit, total) };
  }
}
