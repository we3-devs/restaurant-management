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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetSuperadminDto } from './dto/set-superadmin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Lists users (paginated, optional search)' })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Gets a user' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Creates a staff user with an admin-set initial password',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: "Updates a user's name/email" })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/password')
  @UseGuards(SuperadminGuard)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: "Resets a user's password without revealing the old password" })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, dto.newPassword);
  }

  @Patch(':id/superadmin')
  @UseGuards(SuperadminGuard)
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary:
      "Grants or revokes a user's superadmin flag (superadmin bypasses all permission checks) — callable only by an existing superadmin",
  })
  setSuperadmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetSuperadminDto,
  ) {
    return this.usersService.setSuperadmin(id, dto.isSuperadmin);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary:
      "Revokes all of a user's role assignments (login stays possible, access does not)",
  })
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }

  @Get(':id/role-assignments')
  @RequirePermissions('roles.view')
  @ApiOperation({
    summary:
      "Lists a user's role assignments (guarded by roles.view, not users.view)",
  })
  listRoleAssignments(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.listRoleAssignments(id);
  }

  @Post(':id/role-assignments')
  @RequirePermissions('roles.manage')
  @ApiOperation({
    summary:
      'Assigns a global-scope role to a user (idempotent — reactivates an existing revoked assignment instead of duplicating)',
  })
  assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRoleAssignmentDto,
  ) {
    return this.usersService.assignRole(id, dto);
  }

  @Delete(':id/role-assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Revokes a single role assignment' })
  revokeRoleAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ) {
    return this.usersService.revokeRoleAssignment(id, assignmentId);
  }
}
