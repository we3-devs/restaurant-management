import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { broadcastResourceChanged } from '../../realtime/realtime-bus';

/**
 * Tables that change at very high frequency but back no list view (auth
 * churn, append-only logs already pushed by their own bespoke event, or
 * derivative/junction tables the owning list already covers) — excluded to
 * keep the socket quiet.
 */
const EXCLUDED_TABLES = new Set([
  'refresh_tokens',
  'typeorm_migrations',
  'notifications', // already pushed via KitchenTicketsGateway#notifyNotificationCreated with full payload
  'audit_logs', // append-only, written async off a queue — see audit-logs module
]);

/**
 * Broadcasts a lightweight "go refetch" signal for every entity write, so
 * every list view can stay live without each of the ~40 modules wiring a
 * bespoke gateway call. Real-time payload delivery (e.g. kitchen tickets,
 * notifications) stays on its own existing bespoke events — this only
 * covers invalidation, never carries the changed row itself.
 */
@EventSubscriber()
export class RealtimeChangeSubscriber implements EntitySubscriberInterface {
  afterInsert(event: InsertEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity, 'created');
  }

  afterUpdate(event: UpdateEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity ?? event.databaseEntity, 'updated');
  }

  afterRemove(event: RemoveEvent<ObjectLiteral>): void {
    this.emit(event.metadata.tableName, event.entity ?? event.databaseEntity, 'deleted');
  }

  private emit(tableName: string, entity: ObjectLiteral | undefined, action: 'created' | 'updated' | 'deleted'): void {
    if (EXCLUDED_TABLES.has(tableName) || !entity) return;
    const outletId = this.extractOutletId(entity);
    broadcastResourceChanged(tableName, action, outletId);
  }

  /** Entities carry either an `outletId` column or none (global resources like users/roles/suppliers). */
  private extractOutletId(entity: ObjectLiteral): number | null {
    const raw = entity.outletId;
    if (raw === undefined || raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
}
