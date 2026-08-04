import { Column, Entity, PrimaryColumn } from 'typeorm';

export type WsTicketKind = 'staff' | 'guest';

/** Single-use WebSocket auth ticket — see WsTicketsService. */
@Entity({ name: 'ws_tickets' })
export class WsTicket {
  @PrimaryColumn({ type: 'text' })
  ticket: string;

  @Column({ type: 'text' })
  kind: WsTicketKind;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;
}
