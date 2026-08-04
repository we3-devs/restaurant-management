import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { LessThan, QueryDeepPartialEntity, Repository } from 'typeorm';
import { WsTicket, WsTicketKind } from './ws-ticket.entity';

const CLEANUP_INTERVAL_MS = 5 * 60_000;

/**
 * Postgres-backed replacement for the old Redis ws-ticket keyspace
 * (`kds-ws-ticket:*` / `guest-ws-ticket:*`, `SET ... EX` + `GET`+`DEL` on
 * redeem). `redeem` is a single atomic `DELETE ... RETURNING` rather than
 * SELECT-then-DELETE, so two concurrent redeem attempts for the same ticket
 * still resolve to exactly one winner — Postgres serializes the two
 * DELETEs against the same row.
 */
@Injectable()
export class WsTicketsService {
  private readonly logger = new Logger(WsTicketsService.name);

  constructor(
    @InjectRepository(WsTicket)
    private readonly repository: Repository<WsTicket>,
  ) {}

  async issue(
    kind: WsTicketKind,
    payload: Record<string, unknown>,
    ttlSeconds: number,
  ): Promise<string> {
    const ticket = randomUUID();
    // .insert(), not .save(): the primary key (`ticket`) is a client-
    // generated random UUID, never an existing row, but .save() can't tell
    // that — with a manually-assigned PK it always issues a pre-check
    // SELECT plus an explicit transaction wrapper around the INSERT (4
    // round trips total) to decide insert-vs-update. That's ~650ms+ against
    // this remote pooler even though the actual INSERT is ~160ms. .insert()
    // skips the existence check entirely and runs the single INSERT.
    await this.repository.insert({
      ticket,
      kind,
      payload,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    } satisfies Partial<WsTicket> as QueryDeepPartialEntity<WsTicket>);
    return ticket;
  }

  async redeem(
    ticket: string,
  ): Promise<{ kind: WsTicketKind; payload: Record<string, unknown> } | null> {
    // TypeORM's raw query() returns [rows, affectedCount] for DELETE/UPDATE
    // (unlike INSERT, which returns rows directly) — confirmed empirically,
    // not documented consistently. Destructure, don't just check .length.
    const [rows] = await this.repository.manager.query(
      `DELETE FROM ws_tickets WHERE ticket = $1 AND expires_at > now() RETURNING kind, payload`,
      [ticket],
    );
    return (rows[0] as { kind: WsTicketKind; payload: Record<string, unknown> }) ?? null;
  }

  @Interval(CLEANUP_INTERVAL_MS)
  async cleanupExpired(): Promise<void> {
    try {
      await this.repository.delete({ expiresAt: LessThan(new Date()) });
    } catch (err) {
      this.logger.warn(`ws_tickets cleanup failed: ${(err as Error).message}`);
    }
  }
}
