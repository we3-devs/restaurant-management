import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CustomerAuthService } from '../customer-auth/customer-auth.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { OutletsService } from '../outlets/outlets.service';
import { assertQrAccess } from '../outlets/qr-access.util';
import { QuickOrderJoinDto } from './dto/quick-order-join.dto';
import { TableSessionsService } from './table-sessions.service';

/**
 * Anonymous counterpart to GuestTableSessionsController — deliberately its
 * own controller (not another route there) since it must work with no
 * bearer token at all, and Nest class guards only add to method guards,
 * never replace them. Only reachable for outlets configured for
 * qrOrderingMode: 'quick_order'; every other outlet keeps requiring the
 * OTP-gated GuestTableSessionsController.join() instead.
 */
@ApiTags('table-sessions')
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('table-sessions/quick-order')
export class GuestQuickOrderSessionsController {
  constructor(
    private readonly tableSessions: TableSessionsService,
    private readonly diningTables: DiningTablesService,
    private readonly outlets: OutletsService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  @Post('join')
  @ApiOperation({
    summary:
      'Opens an anonymous guest session for a quick_order-mode outlet, gated by the outlet\'s configured IP/geofence check instead of OTP verification.',
  })
  async join(@Body() dto: QuickOrderJoinDto, @Req() req: Request) {
    const table = await this.diningTables.findByCode(dto.tableCode);
    const outlet = await this.outlets.findOne(table.outletId);

    if (outlet.qrOrderingMode !== 'quick_order') {
      throw new ForbiddenException('This table requires signing in to order');
    }
    assertQrAccess(outlet, { ip: req.ip ?? '', lat: dto.latitude, lon: dto.longitude });

    const session = await this.tableSessions.ensureActiveForScan(table.id, table.outletId);
    const tokens = await this.customerAuth.guestSession(table.id);
    const detail = await this.tableSessions.findOneDetailed(session.id);

    return {
      ...tokens,
      session: {
        id: detail.id,
        outletName: detail.outletName,
        diningTableName: detail.diningTableName,
      },
    };
  }
}
