import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { OutletsService } from '../outlets/outlets.service';
import { JoinTableSessionDto } from './dto/guest-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

/**
 * Deliberately its own controller rather than another route on
 * GuestTableSessionsController: that one applies CustomerJwtAuthGuard at the
 * class level, and Nest *adds* method guards to class guards rather than
 * replacing them, so there is no way to exempt a single route there. The
 * guard is a plain AuthGuard('jwt-customer') with no handleRequest override,
 * which means a request carrying no token is rejected with a 401 — exactly
 * the case this endpoint exists to serve.
 *
 * Scoped to this one anonymous action so the rest of the guest session API
 * keeps requiring a verified customer.
 */
@ApiTags('table-sessions')
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('table-sessions/guest')
export class GuestTableScanController {
  constructor(
    private readonly tableSessions: TableSessionsService,
    private readonly diningTables: DiningTablesService,
    private readonly outlets: OutletsService,
  ) {}

  /**
   * Called the moment a QR code is scanned, before any sign-in. Opens (or
   * reuses) the table's session so the floor board shows it occupied as soon
   * as someone sits down, instead of waiting until they verify a phone number
   * at checkout.
   *
   * Returns only the table's own identity — never the party list, since an
   * anonymous caller holding a table code must not be able to read who is
   * sitting there.
   */
  @Post('scan')
  @ApiOperation({
    summary:
      'Marks the table occupied on QR scan, opening a session if it has none. No sign-in required; the guest is attached to that session later, when they order or call staff.',
  })
  async scan(@Body() dto: JoinTableSessionDto) {
    if (!dto?.tableCode || typeof dto.tableCode !== 'string') {
      throw new BadRequestException('tableCode is required');
    }
    const table = await this.diningTables.findByCode(dto.tableCode);
    const [session, outlet] = await Promise.all([
      this.tableSessions.ensureActiveForScan(table.id, table.outletId),
      this.outlets.findOne(table.outletId),
    ]);
    const detail = await this.tableSessions.findOneDetailed(session.id);
    return {
      id: detail.id,
      outletName: detail.outletName,
      diningTableName: detail.diningTableName,
      qrOrderingMode: outlet.qrOrderingMode,
      qrAccessCheckMode: outlet.qrAccessCheckMode,
    };
  }
}
