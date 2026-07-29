import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PermissionsService } from './permissions.service';
import { User } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
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
