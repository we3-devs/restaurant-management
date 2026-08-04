import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import {
  DashboardCacheSection,
  enqueueDashboardInvalidation,
} from '../../modules/dashboard-cache/dashboard-cache-bridge';

/**
 * Maps a table write to the dashboard cache sections it can affect. Only
 * covers tables that feed the 4 cached endpoints (stats/charts/breakdown/
 * inventory-activity) — see DashboardComputeService's doc comment for which
 * DashboardSummary fields are actually wired to a cache.
 *
 * `order_items`/`kitchen_ticket_items`/`ingredient_wastage_items` are
 * deliberately omitted: every real write to them happens alongside a save
 * to their parent (`orders`/`kitchen_tickets`/`ingredient_wastages`), which
 * is already covered below and carries the outletId needed to target one
 * outlet's cache row.
 */
const TABLE_SECTIONS: Record<string, DashboardCacheSection[]> = {
  orders: ['stats', 'charts', 'breakdown'],
  order_payments: ['stats', 'breakdown'],
  table_sessions: ['stats'],
  kitchen_tickets: ['stats'],
  reservations: ['breakdown'],
  // No outletId column on these rows — outlet is only reachable via a join
  // (warehouse -> outlet), so the affected outlet can't be attributed
  // cheaply here. See DashboardCacheService.rebuildSections: a null
  // outletId rebuilds the affected sections for every outlet instead.
  warehouse_ingredient_stocks: ['stats', 'inventory'],
  ingredient_inventory_transactions: ['stats', 'inventory'],
  ingredient_wastages: ['stats'],
  notifications: ['inventory'],
};

/**
 * Mirrors RealtimeChangeSubscriber: a global TypeORM subscriber (registered
 * in app.module.ts alongside the others) that queues a targeted dashboard
 * cache recompute for every write to a table the dashboard's cached
 * endpoints read from. Kept separate from RealtimeChangeSubscriber/
 * realtime-bus.ts since this drives a different downstream (a BullMQ job,
 * not a websocket broadcast) and has its own table-to-effect mapping.
 */
@EventSubscriber()
export class DashboardCacheSubscriber implements EntitySubscriberInterface {
  afterInsert(event: InsertEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity);
  }

  afterUpdate(event: UpdateEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity ?? event.databaseEntity);
  }

  afterRemove(event: RemoveEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity ?? event.databaseEntity);
  }

  private emit(tableName: string, entity: ObjectLiteral | undefined): void {
    const sections = TABLE_SECTIONS[tableName];
    if (!sections || !entity) return;
    const outletId = this.extractOutletId(entity);
    enqueueDashboardInvalidation(outletId, sections);
  }

  private extractOutletId(entity: ObjectLiteral): number | null {
    const raw = entity.outletId;
    if (raw === undefined || raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
}
