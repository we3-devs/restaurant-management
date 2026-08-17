import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { EmployeesService } from '../employees/employees.service';
import { User } from '../users/entities/user.entity';
import { AssignOrderDto, AssignTableDto, CompleteOrderAssignmentDto } from './dto/assignments.dto';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly employeesService: EmployeesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  // ---- Table assignments ----
  @Post('table-assignments') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Assigns a waiter to a dining table' })
  async assignTable(@Body() dto: AssignTableDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.assignmentsService.assignTable(dto, user.id);
  }

  @Post('table-assignments/:id/unassign') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Unassigns a waiter from a dining table' })
  async unassignTable(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const assignment = await this.assignmentsService.findTableAssignment(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, assignment.outletId);
    return this.assignmentsService.unassignTable(id);
  }

  @Get('table-assignments') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists active table assignments' })
  async listTableAssignments(@Query('outletId') outletId: string | undefined, @CurrentUser() user: User) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, parsedOutletId);
    }
    return this.assignmentsService.listTableAssignments(parsedOutletId, accessible);
  }

  // ---- Order assignments ----
  @Post('order-assignments') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Assigns an order to a waiter' })
  async assignOrder(@Body() dto: AssignOrderDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.assignmentsService.assignOrder(dto, user.id);
  }

  @Post('order-assignments/:id/complete') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Marks an order assignment complete' })
  async completeOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: CompleteOrderAssignmentDto, @CurrentUser() user: User) {
    const assignment = await this.assignmentsService.findOrderAssignment(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, assignment.outletId);
    return this.assignmentsService.completeOrder(id, dto);
  }

  @Post('order-assignments/:id/served') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Marks an order assignment served' })
  async markServed(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const assignment = await this.assignmentsService.findOrderAssignment(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, assignment.outletId);
    return this.assignmentsService.markServed(id);
  }

  @Get('order-assignments') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists active order assignments' })
  async listOrderAssignments(@Query('outletId') outletId: string | undefined, @CurrentUser() user: User) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, parsedOutletId);
    }
    return this.assignmentsService.listOrderAssignments(parsedOutletId, accessible);
  }

  // ---- Staff dashboard ----
  @Get('staff-dashboard') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Staff dashboard aggregates (present, absent, on shift, assigned tables/orders)' })
  async getStaffDashboard(@Query('outletId') outletId: string | undefined, @CurrentUser() user: User) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, parsedOutletId);
    }
    return this.assignmentsService.getStaffDashboard(parsedOutletId, accessible);
  }

  @Get('performance/:employeeId') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Per-employee performance statistics' })
  async getPerformance(@Param('employeeId', ParseIntPipe) employeeId: number, @Query('dateFrom') dateFrom: string | undefined, @Query('dateTo') dateTo: string | undefined, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(employeeId);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, employee.outletId);
    return this.assignmentsService.getPerformance(employeeId, dateFrom, dateTo);
  }
}

