import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Lists roles (paginated, optional search)' })
  findAll(@Query() query: ListRolesQueryDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    return this.rolesService.findAll(query, request.tenantId ?? request.user?.tenantId ?? undefined);
  }

  @Get(':id')
  @RequirePermissions('roles.view')
  @ApiOperation({
    summary: 'Gets a role including its assigned permission slugs',
  })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    return this.rolesService.findOneWithPermissions(id, request.tenantId ?? request.user?.tenantId ?? undefined);
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Creates a custom global-scope role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Updates a tenant role' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    return this.rolesService.update(id, dto, request.tenantId ?? request.user?.tenantId ?? undefined);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary:
      'Deletes a tenant role and its assignments',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    return this.rolesService.remove(id, request.tenantId ?? request.user?.tenantId ?? undefined);
  }

  @Post(':id/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary:
      'Assigns a permission to a tenant role',
  })
  assignPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
    @Req() request: AuthenticatedRequest & { tenantId?: number },
  ) {
    return this.rolesService.assignPermission(id, dto, request.tenantId ?? request.user?.tenantId ?? undefined);
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary: 'Unassigns a permission from a tenant role',
  })
  unassignPermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
    @Req() request: AuthenticatedRequest & { tenantId?: number },
  ) {
    return this.rolesService.unassignPermission(id, permissionId, request.tenantId ?? request.user?.tenantId ?? undefined);
  }
}
