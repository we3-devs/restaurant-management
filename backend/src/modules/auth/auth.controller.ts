import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WsTicketsService } from '../../common/ws-tickets/ws-tickets.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly wsTickets: WsTicketsService,
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
    return { ...tokens, user: this.toAuthUser(user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotates a refresh token for a new access + refresh token pair',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.refresh(dto.refreshToken);
    return { ...tokens, user: this.toAuthUser(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revokes a refresh token' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Returns the current user plus their resolved global permissions',
  })
  async me(@CurrentUser() user: User) {
    const [permissions, outletIds, departmentIds, portal] = await Promise.all([
      this.permissionsService.getPermissionSlugs(user.id),
      this.permissionsService.getAccessibleOutletIds(user.id),
      this.permissionsService.getAccessibleOutletDepartmentIds(user.id),
      user.isSuperadmin
        ? Promise.resolve('dashboard' as const)
        : this.permissionsService.getPortalAccess(user.id),
    ]);
    return {
      ...this.toAuthUser(user),
      permissions: Array.from(permissions),
      outletIds,
      departmentIds,
      portal,
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
    const ticket = await this.wsTickets.issue(
      'staff',
      { userId: user.id, isSuperadmin: user.isSuperadmin },
      WS_TICKET_TTL_SECONDS,
    );
    return { ticket };
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

  private toAuthUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperadmin: user.isSuperadmin,
    };
  }
}
