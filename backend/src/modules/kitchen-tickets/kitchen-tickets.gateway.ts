import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { registerRealtimeServer } from '../../realtime/realtime-bus';
import type { Notification } from '../notifications/entities/notification.entity';
import type { ServiceRequest } from '../service-requests/entities/service-request.entity';
import { KitchenTicketItem } from './entities/kitchen-ticket-item.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';

export const KDS_WS_TICKET_PREFIX = 'kds-ws-ticket:';

interface KdsSocketData {
  userId?: number;
}

type KdsSocket = Omit<Socket, 'data'> & { data: KdsSocketData };

/**
 * Pushes kitchen ticket/item changes to KDS screens in realtime. Auth can't
 * use a normal Authorization header (the browser only ever holds an httpOnly
 * cookie, see frontend/src/lib/auth/session.ts), so clients redeem a
 * short-lived one-time ticket (minted by AuthController#wsTicket) on
 * connect instead — see handleConnection().
 */
@WebSocketGateway({
  namespace: '/kds',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class KitchenTicketsGateway implements OnGatewayConnection, OnGatewayInit {
  private readonly logger = new Logger(KitchenTicketsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Hands the live Socket.IO server to RealtimeChangeSubscriber, which TypeORM instantiates outside Nest's DI graph and so can't inject this gateway directly. */
  afterInit(server: Server): void {
    registerRealtimeServer(server, (outletId) => this.outletRoom(outletId));
  }

  async handleConnection(client: KdsSocket): Promise<void> {
    const ticket = client.handshake.auth?.ticket as string | undefined;
    if (!ticket) {
      client.disconnect(true);
      return;
    }

    const key = `${KDS_WS_TICKET_PREFIX}${ticket}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      client.disconnect(true);
      return;
    }
    await this.redis.del(key);

    let payload: { userId: number; isSuperadmin: boolean };
    try {
      payload = JSON.parse(raw) as { userId: number; isSuperadmin: boolean };
    } catch {
      client.disconnect(true);
      return;
    }

    // No further permission check: this namespace was originally KDS/POS-only
    // (orders.view / orders.manage), but it's now also the sole delivery
    // channel for notification.created — which spans every module
    // (reservations, service requests, loyalty, inventory, HR, ...). A valid
    // one-time ticket already proves the caller is an authenticated staff
    // member; per-event-type access still isn't enforced here (a joined
    // client receives everything emitted to its outlet room), matching the
    // existing coarse room-level model rather than introducing a new one.
    client.data.userId = payload.userId;
  }

  @SubscribeMessage('subscribe-outlet')
  handleSubscribeOutlet(
    @ConnectedSocket() client: KdsSocket,
    @MessageBody() body: { outletId: number },
  ): void {
    if (!client.data.userId || !body?.outletId) {
      return;
    }
    void client.join(this.outletRoom(body.outletId));
  }

  notifyTicketsCreated(tickets: KitchenTicket[]): void {
    for (const ticket of tickets) {
      this.server
        .to(this.outletRoom(ticket.outletId))
        .emit('kitchen.ticket.created', ticket);
    }
  }

  notifyTicketUpdated(ticket: KitchenTicket): void {
    this.server
      .to(this.outletRoom(ticket.outletId))
      .emit('kitchen.ticket.updated', ticket);
  }

  notifyItemUpdated(outletId: number, item: KitchenTicketItem): void {
    this.server
      .to(this.outletRoom(outletId))
      .emit('kitchen.item.updated', item);
  }

  /** Pushes a persisted notification (e.g. "Table 8 — items ready") to every POS/waiter screen on the outlet. */
  notifyNotificationCreated(notification: Notification): void {
    this.server
      .to(this.outletRoom(notification.outletId))
      .emit('notification.created', notification);
  }

  /** Pushes a new guest/staff service request to the outlet's service queue screens. */
  notifyServiceRequestCreated(request: ServiceRequest): void {
    this.server
      .to(this.outletRoom(request.outletId))
      .emit('service_request.created', request);
  }

  private outletRoom(outletId: number): string {
    return `outlet:${outletId}`;
  }
}
