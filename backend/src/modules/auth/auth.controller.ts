import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { KDS_WS_TICKET_PREFIX } from '../kitchen-tickets/kitchen-tickets.gateway';
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
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
    const permissions = await this.permissionsService.getGlobalPermissionSlugs(
      user.id,
    );
    return { ...this.toAuthUser(user), permissions: Array.from(permissions) };
  }

  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mints a short-lived, one-time ticket used to authenticate a WebSocket connection (browsers only ever hold an httpOnly auth cookie, never the JWT itself)',
  })
  async issueWsTicket(@CurrentUser() user: User): Promise<{ ticket: string }> {
    const ticket = randomUUID();
    await this.redis.set(
      `${KDS_WS_TICKET_PREFIX}${ticket}`,
      JSON.stringify({ userId: user.id, isSuperadmin: user.isSuperadmin }),
      'EX',
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
