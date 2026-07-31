import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { Order } from '../orders/entities/order.entity';
import { ListReportQueryDto } from './dto/list-report-query.dto';
import { REPORT_TYPES, type ReportType } from './report-columns';

const DEFAULT_RANGE_DAYS = 30;
const EXPORT_ROW_CAP = 5000;

interface ResolvedQuery {
  outletId?: number;
  from: Date;
  to: Date;
  search?: string;
  sortDir: 'ASC' | 'DESC';
  page: number;
  limit: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  private resolve(query: ListReportQueryDto, forExport = false): ResolvedQuery {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60_000);
    return {
      outletId: query.outletId,
      from,
      to,
      search: query.search,
      sortDir: query.sortDir === 'ASC' ? 'ASC' : 'DESC',
      page: forExport ? 1 : query.page,
      limit: forExport ? EXPORT_ROW_CAP : query.limit,
    };
  }

  async getReport(
    type: ReportType,
    query: ListReportQueryDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    if (!REPORT_TYPES.includes(type)) {
      throw new BadRequestException(`Unknown report type "${type}"`);
    }
    const resolved = this.resolve(query);
    return this.run(type, resolved);
  }

  /** Uncapped-but-bounded row set for export — same filters, no UI pagination. */
  async getReportRowsForExport(
    type: ReportType,
    query: ListReportQueryDto,
  ): Promise<Record<string, unknown>[]> {
    if (!REPORT_TYPES.includes(type)) {
      throw new BadRequestException(`Unknown report type "${type}"`);
    }
    const resolved = this.resolve(query, true);
    const result = await this.run(type, resolved);
    return result.data;
  }

  private async run(
    type: ReportType,
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    switch (type) {
      case 'sales':
        return this.salesReport(resolved);
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
      .addSelect('order.created_at', 'createdAt')
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', {
        outletId: resolved.outletId,
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

  private async ordersReport(
    resolved: ResolvedQuery,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const qb = this.ordersRepository.manager
      .createQueryBuilder()
      .select('order.order_number', 'orderNumber')
      .addSelect('order.created_at', 'createdAt')
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('order.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('warehouse.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
    if (resolved.outletId !== undefined) {
      params.push(resolved.outletId);
      where += ` AND warehouse.outlet_id = $${params.length}`;
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('"order".outlet_id = :outletId', {
        outletId: resolved.outletId,
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('warehouse.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('ticket.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('reservation.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
      resolved.outletId !== undefined
        ? 'AND "order".outlet_id = :outletId'
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
        { from: resolved.from, to: resolved.to, outletId: resolved.outletId },
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
    if (resolved.outletId !== undefined) {
      qb.andWhere('payment.outlet_id = :outletId', {
        outletId: resolved.outletId,
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
}
