import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OutletAccessService, ALL_OUTLETS, AccessibleOutlets } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { SettingsService } from '../settings/settings.service';
import { businessDateRange } from '../../common/reporting/reporting-date.util';
import { ReportsService } from '../reports/reports.service';
import type { ReportType } from '../reports/report-columns';
import { AnalyticsDailySnapshot } from './entities/analytics-daily-snapshot.entity';

type Scope = { from: Date; to: Date; outlets: AccessibleOutlets | number; query: AnalyticsQueryDto };
const n = (value: unknown) => Number(value ?? 0);

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(AnalyticsDailySnapshot) private readonly snapshots: Repository<AnalyticsDailySnapshot>,
    private readonly access: OutletAccessService,
    private readonly settings: SettingsService,
    private readonly reports: ReportsService,
  ) {}

  async dashboard(user: User, query: AnalyticsQueryDto) {
    const [overview, products, inventory, customers] = await Promise.all([
      this.overview(user, query),
      this.products(user, query),
      this.inventory(user, query),
      this.customers(user, query),
    ]);
    const outlets = await this.access.getAccessibleOutletIds(user.id, user.isSuperadmin);
    const reportQuery = { dateFrom: query.from, dateTo: query.to, outletId: query.outletId, page: 1, limit: 5000 };
    const reportTypes: ReportType[] = ['purchase-orders', 'goods-receiving', 'purchase-returns', 'supplier-payments', 'reservations', 'attendance', 'shifts', 'loyalty-transactions', 'audit-logs'];
    const reports = await Promise.all(reportTypes.map(async (type) => [type, await this.reports.getReport(type, reportQuery, outlets)] as const));
    return {
      range: overview.range,
      sales: overview,
      products,
      customers,
      inventory,
      domains: Object.fromEntries(reports.map(([type, result]) => [type, result])),
    };
  }

  async daily(user: User, query: AnalyticsQueryDto) {
    const range = await this.snapshotRange(query);
    const outlets = await this.access.getAccessibleOutletIds(user.id, user.isSuperadmin);
    const qb = this.snapshots.createQueryBuilder('snapshot')
      .where('snapshot.business_date BETWEEN :from AND :to', { from: range.from, to: range.to })
      .orderBy('snapshot.business_date', 'ASC');
    if (query.outletId !== undefined) {
      if (outlets !== ALL_OUTLETS && !outlets.includes(query.outletId)) throw new ForbiddenException('You do not have access to this outlet');
      qb.andWhere('snapshot.outlet_id = :outletId', { outletId: query.outletId });
    } else if (outlets !== ALL_OUTLETS) {
      // 0 is the persisted all-accessible-outlets aggregate.
      qb.andWhere('snapshot.outlet_id IN (:...outletIds)', { outletIds: [...outlets, 0] });
    }
    const rows = await qb.getMany();
    return { range, rows: rows.map((row) => ({ businessDate: row.businessDate, outletId: row.outletId, version: row.version, generatedAt: row.generatedAt, payload: row.payload })) };
  }

  async refreshDaily(user: User, query: AnalyticsQueryDto) {
    const range = await this.snapshotRange(query);
    const from = new Date(`${range.from}T00:00:00Z`);
    const to = new Date(`${range.to}T00:00:00Z`);
    const refreshed: string[] = [];
    for (const cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const businessDate = cursor.toISOString().slice(0, 10);
      const payload = await this.dashboard(user, { ...query, from: businessDate, to: businessDate });
      await this.snapshots.upsert({ outletId: query.outletId ?? 0, businessDate, version: 1, payload }, ['outletId', 'businessDate']);
      refreshed.push(businessDate);
    }
    return { range, refreshed };
  }

  async backfill(user: User, query: AnalyticsQueryDto) {
    const outlets = await this.access.getAccessibleOutletIds(user.id, user.isSuperadmin);
    const earliest = this.orders.createQueryBuilder('order').select('MIN(order.created_at)', 'firstOrder');
    if (query.outletId !== undefined) {
      if (outlets !== ALL_OUTLETS && !outlets.includes(query.outletId)) throw new ForbiddenException('You do not have access to this outlet');
      earliest.andWhere('order.outlet_id = :outletId', { outletId: query.outletId });
    } else if (outlets !== ALL_OUTLETS) {
      earliest.andWhere('order.outlet_id IN (:...outletIds)', { outletIds: outlets });
    }
    const firstRow = await earliest.getRawOne<{ firstOrder: Date | string | null }>();
    if (!firstRow?.firstOrder) return { range: null, refreshed: [], message: 'No historical orders found.' };
    const business = await this.settings.getBusinessSettings();
    const timezone = typeof business.timezone === 'string' && business.timezone ? business.timezone : 'Asia/Kathmandu';
    const firstDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(firstRow.firstOrder));
    const range = await this.snapshotRange({ ...query, from: query.from ?? firstDate });
    return this.refreshDaily(user, { ...query, from: range.from, to: query.to ?? new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()) });
  }

  private async snapshotRange(query: AnalyticsQueryDto) {
    const business = await this.settings.getBusinessSettings();
    const timezone = typeof business.timezone === 'string' && business.timezone ? business.timezone : undefined;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone ?? 'UTC' }).format(new Date());
    const from = query.from ?? today;
    const to = query.to ?? from;
    if (from > to) throw new ForbiddenException('from must be before or equal to to');
    // Keep the persisted key in business-date format while still validating the configured timezone.
    businessDateRange(from, to, timezone);
    return { from, to };
  }

  private async scope(user: User, query: AnalyticsQueryDto): Promise<Scope> {
    const outlets = await this.access.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.outletId !== undefined && outlets !== ALL_OUTLETS && !outlets.includes(query.outletId)) throw new ForbiddenException('You do not have access to this outlet');
    if (outlets.length === 0) throw new ForbiddenException('You do not have access to any outlet');
    const business = await this.settings.getBusinessSettings();
    const timezone = typeof business.timezone === 'string' && business.timezone ? business.timezone : undefined;
    const { from, to } = businessDateRange(query.from, query.to, timezone);
    return { from, to, outlets: query.outletId === undefined ? outlets : query.outletId, query };
  }

  private apply(qb: SelectQueryBuilder<any>, alias: string, scope: Scope, outletColumn = 'outlet_id') {
    qb.andWhere(`${alias}.created_at BETWEEN :from AND :to`, { from: scope.from, to: scope.to });
    if (scope.outlets !== ALL_OUTLETS) qb.andWhere(`${alias}.${outletColumn} IN (:...outletIds)`, { outletIds: Array.isArray(scope.outlets) ? scope.outlets : [scope.outlets] });
    if (scope.query.orderSource) qb.andWhere(`${alias}.order_source = :orderSource`, { orderSource: scope.query.orderSource });
    if (scope.query.orderType) qb.andWhere(`${alias}.order_type = :orderType`, { orderType: scope.query.orderType });
    if (scope.query.departmentId) qb.andWhere(`EXISTS (SELECT 1 FROM order_items analytics_department_item WHERE analytics_department_item.order_id = ${alias}.id AND analytics_department_item.preparation_department_id = :departmentId)`, { departmentId: scope.query.departmentId });
    return qb;
  }

  async overview(user: User, query: AnalyticsQueryDto) {
    const scope = await this.scope(user, query);
    const base = this.apply(this.orders.createQueryBuilder('o'), 'o', scope).andWhere("o.status != 'cancelled'");
    const row = await base.clone().select('COUNT(*)', 'orders').addSelect('COALESCE(SUM(o.grand_total),0)', 'grossSales').addSelect('COALESCE(SUM(o.subtotal - o.discount_amount + o.service_charge_amount + o.tax_amount - o.refunded_amount),0)', 'netSales').addSelect('COALESCE(SUM(o.discount_amount),0)', 'discounts').addSelect('COALESCE(SUM(o.tax_amount),0)', 'tax').addSelect('COALESCE(SUM(o.service_charge_amount),0)', 'serviceCharge').addSelect('COALESCE(SUM(o.refunded_amount),0)', 'refunds').addSelect('COALESCE(SUM(o.due_amount),0)', 'outstanding').addSelect('COALESCE(SUM(o.loyalty_discount_amount),0)', 'loyaltyDiscount').addSelect('COUNT(DISTINCT o.customer_id) FILTER (WHERE o.customer_id IS NOT NULL)', 'customers').getRawOne();
    const orders = n(row?.orders);
    const trend = await base.clone().select("TO_CHAR(o.created_at, 'YYYY-MM-DD')", 'date').addSelect('COUNT(*)', 'orders').addSelect('COALESCE(SUM(o.grand_total),0)', 'revenue').groupBy('date').orderBy('date').getRawMany();
    const [sources, types, payments, itemRow] = await Promise.all([
      base.clone().select('o.order_source', 'name').addSelect('COUNT(*)', 'orders').addSelect('COALESCE(SUM(o.grand_total),0)', 'revenue').groupBy('o.order_source').getRawMany(),
      base.clone().select('o.order_type', 'name').addSelect('COUNT(*)', 'orders').groupBy('o.order_type').getRawMany(),
      (() => { const q = this.orders.manager.createQueryBuilder().select('p.method','name').addSelect('COALESCE(SUM(p.amount),0)','amount').from('order_payments','p').where("p.status='completed' AND p.type='payment'").andWhere('p.paid_at BETWEEN :from AND :to',{from:scope.from,to:scope.to}); if (scope.outlets !== ALL_OUTLETS) q.andWhere('p.outlet_id IN (:...outletIds)',{outletIds:Array.isArray(scope.outlets)?scope.outlets:[scope.outlets]}); return q.groupBy('p.method').getRawMany(); })(),
      base.clone().innerJoin('order_items','items','items.order_id=o.id').select('COALESCE(SUM(items.quantity),0)','itemsSold').getRawOne(),
    ]);
    return { range: { from: scope.from, to: scope.to }, kpis: { grossSales:n(row?.grossSales), netSales:n(row?.netSales), orders, averageOrderValue: orders ? n(row?.grossSales)/orders : 0, customers:n(row?.customers), itemsSold:n(itemRow?.itemsSold), discounts:n(row?.discounts), tax:n(row?.tax), serviceCharge:n(row?.serviceCharge), refunds:n(row?.refunds), outstanding:n(row?.outstanding), loyaltyDiscount:n(row?.loyaltyDiscount) }, trend: trend.map(x=>({date:x.date,orders:n(x.orders),revenue:n(x.revenue)})), orderMix: { sources: sources.map(x=>({name:x.name,orders:n(x.orders),revenue:n(x.revenue)})), types: types.map(x=>({name:x.name,orders:n(x.orders)})) }, paymentMix: payments.map(x=>({name:x.name,amount:n(x.amount)})) };
  }

  async products(user: User, query: AnalyticsQueryDto) {
    const scope = await this.scope(user, query);
    const qb = this.apply(this.orders.manager.createQueryBuilder().from('order_items','i').innerJoin('orders','o','o.id=i.order_id').innerJoin('foods','f','f.id=i.food_id').leftJoin('food_categories','c','c.id=f.food_category_id'),'o',scope).andWhere("o.status != 'cancelled'");
    const rows = await qb.select('f.id','foodId').addSelect('f.name','food').addSelect('SUM(i.quantity)','quantity').addSelect('SUM(i.total_amount)','revenue').addSelect('COUNT(DISTINCT o.id)','orders').groupBy('f.id').addGroupBy('f.name').orderBy('revenue','DESC').limit(50).getRawMany();
    const total = rows.reduce((s,r)=>s+n(r.revenue),0);
    const categories = await qb.clone().select('COALESCE(c.id,0)','categoryId').addSelect("COALESCE(c.name,'Uncategorized')",'category').addSelect('SUM(i.quantity)','quantity').addSelect('SUM(i.total_amount)','revenue').addSelect('COUNT(DISTINCT o.id)','orders').groupBy('c.id').addGroupBy('c.name').orderBy('revenue','DESC').getRawMany();
    return { foods: rows.map(r=>({foodId:n(r.foodId),food:r.food,quantity:n(r.quantity),revenue:n(r.revenue),orders:n(r.orders),averagePrice:n(r.quantity)?n(r.revenue)/n(r.quantity):0,share:total?n(r.revenue)/total*100:0})), categories: categories.map(r=>({categoryId:n(r.categoryId),category:r.category,quantity:n(r.quantity),revenue:n(r.revenue),orders:n(r.orders)})) };
  }

  async inventory(user: User, query: AnalyticsQueryDto) {
    const scope = await this.scope(user, query);
    const db = this.orders.manager;
    const stocks = db.createQueryBuilder().select('i.id','ingredientId').addSelect('i.name','ingredient').addSelect('MAX(i.reorder_level)','reorderLevel').addSelect('MAX(i.minimum_stock)','minimumStock').addSelect('SUM(s.quantity)','quantity').addSelect('SUM(s.stock_value)','value').addSelect('SUM(s.reserved_quantity)','reserved').from('warehouse_ingredient_stocks','s').innerJoin('ingredients','i','i.id=s.ingredient_id').innerJoin('warehouses','w','w.id=s.warehouse_id').where('i.is_active=true');
    if (scope.outlets !== ALL_OUTLETS) stocks.andWhere('w.outlet_id IN (:...outletIds)',{outletIds:Array.isArray(scope.outlets)?scope.outlets:[scope.outlets]});
    const stockRows = await stocks.groupBy('i.id').addGroupBy('i.name').orderBy('quantity','ASC').getRawMany();
    const tx = db.createQueryBuilder().select('t.transaction_type','type').addSelect('COALESCE(SUM(t.quantity_out),0)','quantity').from('ingredient_inventory_transactions','t').innerJoin('warehouses','w','w.id=t.warehouse_id').where('t.created_at BETWEEN :from AND :to',{from:scope.from,to:scope.to});
    if (scope.outlets !== ALL_OUTLETS) tx.andWhere('w.outlet_id IN (:...outletIds)',{outletIds:Array.isArray(scope.outlets)?scope.outlets:[scope.outlets]});
    const movement = await tx.groupBy('t.transaction_type').getRawMany();
    return { kpis:{ inventoryValue:stockRows.reduce((s,r)=>s+n(r.value),0), lowStock:stockRows.filter(r=>n(r.quantity)>0 && n(r.quantity)<=Math.max(n(r.reorderLevel),n(r.minimumStock))).length, outOfStock:stockRows.filter(r=>n(r.quantity)<=0).length, reservedStock:stockRows.reduce((s,r)=>s+n(r.reserved),0) }, stock:stockRows.slice(0,100).map(r=>({ingredientId:n(r.ingredientId),ingredient:r.ingredient,quantity:n(r.quantity),value:n(r.value)})), movement:movement.map(r=>({type:r.type,quantity:n(r.quantity)})) };
  }

  async customers(user: User, query: AnalyticsQueryDto) {
    const scope = await this.scope(user, query); const base = this.apply(this.orders.createQueryBuilder('o'),'o',scope).andWhere("o.status != 'cancelled'").andWhere('o.customer_id IS NOT NULL');
    const priorOutlet = scope.outlets === ALL_OUTLETS ? '' : 'AND prior.outlet_id IN (:...outletIds)';
    const prior = `EXISTS (SELECT 1 FROM orders prior WHERE prior.customer_id = o.customer_id AND prior.status != 'cancelled' AND prior.created_at < :from ${priorOutlet})`;
    const row=await base.clone().select('COUNT(DISTINCT o.customer_id)','customers').addSelect('COUNT(*)','orders').addSelect('SUM(o.grand_total)','spend').addSelect(`COUNT(DISTINCT o.customer_id) FILTER (WHERE NOT ${prior})`,'newCustomers').addSelect(`COUNT(DISTINCT o.customer_id) FILTER (WHERE ${prior})`,'returningCustomers').setParameters({ from: scope.from, ...(scope.outlets === ALL_OUTLETS ? {} : { outletIds: Array.isArray(scope.outlets) ? scope.outlets : [scope.outlets] }) }).getRawOne();
    const totalCustomers=n(row?.customers), orders=n(row?.orders), returningCustomers=n(row?.returningCustomers);
    const outletClause = scope.outlets === ALL_OUTLETS ? '' : 'AND o.outlet_id = ANY($3::bigint[])';
    const firstOutletClause = scope.outlets === ALL_OUTLETS ? '' : 'AND o2.outlet_id = ANY($3::bigint[])';
    const trendRows = await this.orders.manager.query(`SELECT day::date AS date, COUNT(DISTINCT daily.customer_id) FILTER (WHERE first_order.first_order_at::date = day::date) AS "newCount", COUNT(DISTINCT daily.customer_id) FILTER (WHERE first_order.first_order_at::date < day::date) AS "returningCount" FROM generate_series($1::date, $2::date, interval '1 day') AS day LEFT JOIN LATERAL (SELECT DISTINCT o.customer_id FROM orders o WHERE o.status != 'cancelled' AND o.created_at::date = day::date ${outletClause}) daily ON true LEFT JOIN LATERAL (SELECT MIN(o2.created_at) AS first_order_at FROM orders o2 WHERE o2.customer_id = daily.customer_id AND o2.status != 'cancelled' ${firstOutletClause}) first_order ON true WHERE daily.customer_id IS NOT NULL GROUP BY day ORDER BY day`, scope.outlets === ALL_OUTLETS ? [scope.from, scope.to] : [scope.from, scope.to, Array.isArray(scope.outlets) ? scope.outlets : [scope.outlets]]);
    return { kpis:{totalCustomers,orders,newCustomers:n(row?.newCustomers),returningCustomers,repeatRate:totalCustomers?returningCustomers/totalCustomers*100:0,averageSpend:totalCustomers?n(row?.spend)/totalCustomers:0,averageVisits:totalCustomers?orders/totalCustomers:0}, trend:trendRows.map((r:{date:string;newCount:string;returningCount:string})=>({date:String(r.date).slice(0,10),newCount:n(r.newCount),returningCount:n(r.returningCount)})) };
  }
}
