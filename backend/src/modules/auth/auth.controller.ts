import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    return { ...tokens, user: await this.toAuthUser(user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotates a refresh token for a new access + refresh token pair',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.refresh(dto.refreshToken);
    return { ...tokens, user: await this.toAuthUser(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revokes a refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    const logoutStart = Date.now();

    await this.authService.logout(dto.refreshToken);

    const logoutDuration = Date.now() - logoutStart;
    this.logger.log(
      `[PERF:logout] total=${logoutDuration}ms`
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Returns the current user plus their resolved global permissions',
  })
  async me(@CurrentUser() user: User) {
    const meStartUs = this.nowMicros();
    const phases: Record<string, number> = {};

    // Only fetch critical data for initial render:
    // - permissions: needed for UI visibility decisions
    // - portal: needed for routing decision
    // Defer outlet/department IDs until outlet picker loads (separate API call)

    // Measure permission fetch
    const permStartUs = this.nowMicros();
    const permissions = await this.permissionsService.getPermissionSlugs(user.id);
    phases['permissions'] = Math.round((this.nowMicros() - permStartUs) / 1000);

    // Measure portal access
    const portalStartUs = this.nowMicros();
    const portal = user.isSuperadmin
      ? ('dashboard' as const)
      : await this.permissionsService.getPortalAccess(user.id);
    const hasBothPortals = user.isSuperadmin
      ? true
      : await this.permissionsService.hasBothPortals(user.id);
    phases['portal'] = Math.round((this.nowMicros() - portalStartUs) / 1000);

    // Measure role fetch
    const roleStartUs = this.nowMicros();
    const roleSlugs = await this.permissionsService.getRoleSlugs(user.id);
    phases['roles'] = Math.round((this.nowMicros() - roleStartUs) / 1000);

    const meDurationMs = Math.round((this.nowMicros() - meStartUs) / 1000);
    const phaseStr = Object.entries(phases)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(' ');
    this.logger.log(
      `[PERF:AUTH_ME] userId=${user.id} total=${meDurationMs}ms (${phaseStr})`
    );

    return {
      ...(await this.toAuthUser(user, portal, hasBothPortals)),
      permissions: Array.from(permissions),
      outletIds: [],  // Defer to outlet picker fetch
      departmentIds: [],  // Defer to department select fetch
      roleSlugs,
    };
  }

  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mints a short-lived, one-time ticket used to authenticate a WebSocket connection (browsers only ever hold an httpOnly auth cookie, never the JWT itself)',
  })
  async issueWsTicket(@CurrentUser() user: User): Promise<{ ticket: string }> {
    const wsStartUs = this.nowMicros();

    const ticket = await this.wsTickets.issue(
      'staff',
      { userId: user.id, isSuperadmin: user.isSuperadmin },
      WS_TICKET_TTL_SECONDS,
    );

    const wsDurationMs = Math.round((this.nowMicros() - wsStartUs) / 1000);
    this.logger.log(
      `[PERF:WS_TICKET] userId=${user.id} total=${wsDurationMs}ms`
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
  adminCheck() {
    return { ok: true };
  }

  // Includes `portal` (same resolution as /auth/me) so the login response
  // alone is enough for the client to pick its landing app, without a
  // separate /auth/me round trip just to make that decision. `me()` already
  // resolves portal itself (alongside permissions/outlets/roles in one
  // Promise.all) and passes it in to avoid resolving it twice.
  private async toAuthUser(
    user: User,
    portal?: 'dashboard' | 'staff',
    hasBothPortals?: boolean,
  ) {
    const resolvedPortal =
      portal ??
      (user.isSuperadmin
        ? ('dashboard' as const)
        : await this.permissionsService.getPortalAccess(user.id));
    const resolvedHasBothPortals =
      hasBothPortals ??
      (user.isSuperadmin
        ? true
        : await this.permissionsService.hasBothPortals(user.id));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperadmin: user.isSuperadmin,
      portal: resolvedPortal,
      hasBothPortals: resolvedHasBothPortals,
    };
  }
}
