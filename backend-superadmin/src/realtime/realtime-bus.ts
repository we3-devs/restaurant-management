import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

export type RealtimeAction = 'created' | 'updated' | 'deleted';

export interface ResourceChangedPayload {
  resource: string;
  action: RealtimeAction;
  outletId: number | null;
}

const logger = new Logger('RealtimeBus');

/**
 * A module-level bridge between the TypeORM subscriber (which TypeORM
 * instantiates itself — outside Nest's DI container, see
 * TimestampSubscriber's registration in app.module.ts for the same
 * constraint) and the Socket.IO server owned by KitchenTicketsGateway (a
 * real Nest provider). The gateway registers its server here on init; the
 * subscriber calls broadcast() without needing any injected dependencies.
 */
let ioServer: Server | null = null;
let outletRoom: ((outletId: number) => string) | null = null;

const pendingChanges = new Map<string, ResourceChangedPayload>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushChanges(): void {
  flushTimer = null;
  if (!ioServer || pendingChanges.size === 0) return;
  const changes = [...pendingChanges.values()];
  pendingChanges.clear();
  const scoped = new Map<string, ResourceChangedPayload[]>();
  for (const change of changes) {
    const key = change.outletId === null ? 'global' : String(change.outletId);
    const list = scoped.get(key);
    if (list) list.push(change);
    else scoped.set(key, [change]);
  }
  for (const [scope, batch] of scoped) {
    if (scope !== 'global' && outletRoom) {
      ioServer.to(outletRoom(Number(scope))).emit('resource.changed.batch', batch);
    } else {
      ioServer.emit('resource.changed.batch', batch);
    }
  }
}

export function registerRealtimeServer(server: Server, roomFn: (outletId: number) => string): void {
  ioServer = server;
  outletRoom = roomFn;
}

/**
 * Fire-and-forget change notification — clients treat this as "go
 * refetch", never as the source of truth for the changed data itself.
 * `outletId: null` broadcasts to every connected socket (for resources with
 * no outlet scope, e.g. users/roles/suppliers/settings).
 */
export function broadcastResourceChanged(resource: string, action: RealtimeAction, outletId: number | null): void {
  if (!ioServer) {
    logger.warn(`Realtime server not yet registered — dropped ${resource}.${action}`);
    return;
  }
  const payload: ResourceChangedPayload = { resource, action, outletId };
  // TypeORM commonly emits several writes for one user action. Coalesce the
  // same resource/action/scope for one event-loop turn plus 25ms so clients do
  // one invalidation/refetch instead of a request per row write.
  pendingChanges.set(`${resource}:${action}:${outletId ?? 'global'}`, payload);
  if (flushTimer === null) flushTimer = setTimeout(flushChanges, 25);
}
