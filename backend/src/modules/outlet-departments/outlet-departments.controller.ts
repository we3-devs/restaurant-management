import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import { CreateOutletDepartmentDto } from './dto/create-outlet-department.dto';
import { ListOutletDepartmentsQueryDto } from './dto/list-outlet-departments-query.dto';
import { UpdateOutletDepartmentDto } from './dto/update-outlet-department.dto';
import { OutletDepartmentsService } from './outlet-departments.service';

@ApiTags('outlet-departments')
@ApiBearerAuth()
@Controller('outlet-departments')
export class OutletDepartmentsController {
  constructor(
    private readonly outletDepartmentsService: OutletDepartmentsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('outlet-departments.view')
  @ApiOperation({
    summary:
      'Lists outlet departments (paginated, optional search + outletId filter)',
  })
  findAll(@Query() query: ListOutletDepartmentsQueryDto) {
    return this.outletDepartmentsService.findAll(query);
  }

  /**
   * Departments at one outlet, scoped to the current user's own assignments —
   * no `outlet-departments.view` permission required, since seeing your own
   * station is an assignment fact, not a permission grant. Narrows to the
   * user's assigned department(s) at that outlet when they have any; returns
   * every department at the outlet for superadmins and globally-scoped users.
   * Declared before `:id` so "assigned" isn't parsed as an id.
   */
  @Get('assigned')
  @ApiOperation({
    summary:
      "Lists the current user's accessible departments for one outlet, without requiring outlet-departments.view",
  })
  async findAssigned(
    @Query('outletId', ParseIntPipe) outletId: number,
    @CurrentUser() user: User,
  ) {
    if (!user.isSuperadmin) {
      const outletIds = await this.permissionsService.getAccessibleOutletIds(
        user.id,
      );
      // null: no active role assignment at all -> no outlet access.
      if (outletIds === null) {
        throw new ForbiddenException('Not assigned to this outlet');
      }
      if (outletIds.length > 0 && !outletIds.includes(outletId)) {
        throw new ForbiddenException('Not assigned to this outlet');
      }
    }

    const departments =
      await this.outletDepartmentsService.findByOutlet(outletId);

    if (user.isSuperadmin) return departments;

    const departmentIds =
      await this.permissionsService.getAccessibleOutletDepartmentIds(user.id);
    if (departmentIds.length === 0) return departments;

    const scoped = departments.filter((department) =>
      departmentIds.includes(department.id),
    );
    return scoped.length > 0 ? scoped : departments;
  }

  @Get(':id')
  @RequirePermissions('outlet-departments.view')
  @ApiOperation({ summary: 'Gets an outlet department' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletDepartmentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({ summary: 'Creates an outlet department' })
  create(@Body() dto: CreateOutletDepartmentDto) {
    return this.outletDepartmentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({
    summary: 'Updates an outlet department (outletId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutletDepartmentDto,
  ) {
    return this.outletDepartmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({ summary: 'Soft-deletes an outlet department' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outletDepartmentsService.remove(id);
  }
}
