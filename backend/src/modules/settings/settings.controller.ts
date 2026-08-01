import { BadRequestException, Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { SettingsCategory } from './entities/global-setting.entity';
import { SETTINGS_CATEGORIES, SettingsService } from './settings.service';

function assertKnownCategory(category: string): asserts category is SettingsCategory {
  if (!SETTINGS_CATEGORIES.includes(category as SettingsCategory)) {
    throw new BadRequestException(
      `Unknown settings category "${category}" — expected one of ${SETTINGS_CATEGORIES.join(', ')}`,
    );
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Returns all settings categories as one object' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Get(':category')
  @RequirePermissions('settings.view')
  @ApiOperation({ summary: 'Returns one settings category, merged with defaults' })
  getOne(@Param('category') category: string) {
    assertKnownCategory(category);
    return this.settingsService.get(category);
  }

  // Category is a dynamic path param, so there's no single DTO class NestJS
  // could auto-bind here — validated loosely as a partial record instead.
  @Put(':category')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Partially updates one settings category' })
  update(
    @Param('category') category: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    assertKnownCategory(category);
    return this.settingsService.update(
      category,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
  }
}
