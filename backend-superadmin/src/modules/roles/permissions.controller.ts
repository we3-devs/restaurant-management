import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RolesService } from './roles.service';

/**
 * Read-only. Permission rows correspond 1:1 to real @RequirePermissions()
 * guard slugs in code — new slugs are added via the seed script whenever a
 * future domain adds a real guard, never through this (or any) admin UI.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({
    summary:
      'Lists all permissions (read-only — used to populate role-assignment pickers)',
  })
  findAll() {
    return this.rolesService.listPermissions();
  }
}
