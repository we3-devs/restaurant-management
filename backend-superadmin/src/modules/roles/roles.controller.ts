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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Lists roles (paginated, optional search)' })
  findAll(@Query() query: ListRolesQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('roles.view')
  @ApiOperation({
    summary: 'Gets a role including its assigned permission slugs',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOneWithPermissions(id);
  }

  @Post()
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Creates a custom global-scope role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Updates a role (blocked for system roles)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary:
      'Deletes a role (blocked for system roles; cascades role_permissions/assignments)',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary:
      'Assigns a permission to a role (idempotent, blocked for system roles)',
  })
  assignPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rolesService.assignPermission(id, dto);
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary: 'Unassigns a permission from a role (blocked for system roles)',
  })
  unassignPermission(
    @Param('id', ParseIntPipe) id: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.rolesService.unassignPermission(id, permissionId);
  }
}
