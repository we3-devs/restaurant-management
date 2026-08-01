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
  if (outletId !== null && outletRoom) {
    ioServer.to(outletRoom(outletId)).emit('resource.changed', payload);
  } else {
    ioServer.emit('resource.changed', payload);
  }
}
