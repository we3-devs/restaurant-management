import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WsTicketsService } from '../../common/ws-tickets/ws-tickets.service';
import { PoolMetrics } from '../../common/instrumentation/pool-metrics';
import { SkipAudit } from '../audit-logs/decorators/skip-audit.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PermissionsService } from './permissions.service';
import { User } from '../users/entities/user.entity';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './types/authenticated-request';

const WS_TICKET_TTL_SECONDS = 30;

@ApiTags('auth')
@Controller('auth')
// Login/logout already record their own precise audit entry (see
// AuthService); refresh/ws-ticket are too high-frequency/low-signal to be
// worth a row each.
@SkipAudit()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly wsTickets: WsTicketsService,
    private readonly poolMetrics: PoolMetrics,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email/password login, returns an access + refresh token pair',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Authenticated session',
  })
  async login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.login(
      dto.email,
      dto.password,
      typeof request.headers['x-tenant-slug'] === 'string'
        ? request.headers['x-tenant-slug']
        : undefined,
    );
    return { ...tokens, user: await this.toAuthUser(user, undefined, undefined, true) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotates a refresh token for a new access + refresh token pair',
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Rotated session' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.refresh(dto.refreshToken);
    return { ...tokens, user: await this.toAuthUser(user, undefined, undefined, true) };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revokes a refresh token' })
  @ApiNoContentResponse({ description: 'Refresh token revoked' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    const logoutStart = Date.now();

    await this.authService.logout(dto.refreshToken);

    const logoutDuration = Date.now() - logoutStart;
    this.logger.log(`[PERF:logout] total=${logoutDuration}ms`);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Returns the current user plus their resolved global permissions',
  })
  @ApiOkResponse({
    description: 'Current user, portal, permissions, and accessible scopes',
  })
  async me(@CurrentUser() user: User) {
    const meStartUs = this.nowMicros();
    const phases: Record<string, number> = {};

    const permStartUs = this.nowMicros();
    const portalStartUs = this.nowMicros();
    const positionStartUs = this.nowMicros();
    const [permissions, portal, hasBothPortals, positionSlugs] = await Promise.all([
      this.permissionsService.getPermissionSlugs(user.id),
      this.permissionsService.getPortalAccess(user.id),
      this.permissionsService.hasBothPortals(user.id),
      this.permissionsService.getPositionSlugs(user.id),
    ]);
    const resolvedUs = this.nowMicros();
    phases['permissions'] = Math.round((resolvedUs - permStartUs) / 1000);
    phases['portal'] = Math.round((resolvedUs - portalStartUs) / 1000);
    phases['positions'] = Math.round((this.nowMicros() - positionStartUs) / 1000);

    const meDurationMs = Math.round((this.nowMicros() - meStartUs) / 1000);
    const phaseStr = Object.entries(phases)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(' ');
    this.logger.log(
      `[PERF:AUTH_ME] userId=${user.id} total=${meDurationMs}ms (${phaseStr})`,
    );

    return {
      ...(await this.toAuthUser(user, portal, hasBothPortals, true)),
      permissions: Array.from(permissions),
      departmentIds: [], // Defer to department select fetch
      positionSlugs,
    };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Changes the authenticated user's password and signs out their other sessions",
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      request.sessionId,
    );
  }

  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mints a short-lived, one-time ticket used to authenticate a WebSocket connection (browsers only ever hold an httpOnly auth cookie, never the JWT itself)',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { ticket: { type: 'string' } } },
  })
  async issueWsTicket(@CurrentUser() user: User): Promise<{ ticket: string }> {
    const wsStartUs = this.nowMicros();

    const ticket = await this.wsTickets.issue(
      'staff',
      { userId: user.id },
      WS_TICKET_TTL_SECONDS,
    );

    const wsDurationMs = Math.round((this.nowMicros() - wsStartUs) / 1000);
    this.logger.log(
      `[PERF:WS_TICKET] userId=${user.id} total=${wsDurationMs}ms`,
    );

    return { ticket };
  }

  private nowMicros(): number {
    const [seconds, nanos] = process.hrtime();
    return seconds * 1_000_000 + Math.round(nanos / 1_000);
  }

  @Get('admin-check')
  @ApiBearerAuth()
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary:
      'Reference endpoint proving PermissionsGuard: requires the users.manage permission',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean', example: true } },
    },
  })
  adminCheck() {
    return { ok: true };
  }

  private async toAuthUser(
    user: User,
    portal?: 'dashboard' | 'staff',
    hasBothPortals?: boolean,
    includeOutletIds = false,
  ) {
    const [resolvedPortal, resolvedHasBothPortals, employeeOutletIds] = await Promise.all([
      portal ? Promise.resolve(portal) : this.permissionsService.getPortalAccess(user.id),
      hasBothPortals !== undefined
        ? Promise.resolve(hasBothPortals)
        : this.permissionsService.hasBothPortals(user.id),
      includeOutletIds
        ? this.permissionsService.getEmployeeAssignedOutletIds(user.id)
        : Promise.resolve([]),
    ]);
    const outletIds = includeOutletIds
      ? (employeeOutletIds.length > 0
        ? employeeOutletIds
        : ((await this.permissionsService.getAccessibleOutletIds(user.id)) ?? []))
      : [];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      portal: resolvedPortal,
      hasBothPortals: resolvedHasBothPortals,
      outletIds,
    };
  }
}
