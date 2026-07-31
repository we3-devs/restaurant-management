import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AssignOrderDto, AssignTableDto, CompleteOrderAssignmentDto } from './dto/assignments.dto';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  // ---- Table assignments ----
  @Post('table-assignments') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Assigns a waiter to a dining table' })
  assignTable(@Body() dto: AssignTableDto, @CurrentUser() user: User) {
    return this.assignmentsService.assignTable(dto, user.id);
  }

  @Post('table-assignments/:id/unassign') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Unassigns a waiter from a dining table' })
  unassignTable(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.unassignTable(id);
  }

  @Get('table-assignments') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists active table assignments' })
  listTableAssignments(@Query('outletId') outletId?: string) {
    return this.assignmentsService.listTableAssignments(outletId ? Number(outletId) : undefined);
  }

  // ---- Order assignments ----
  @Post('order-assignments') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Assigns an order to a waiter' })
  assignOrder(@Body() dto: AssignOrderDto, @CurrentUser() user: User) {
    return this.assignmentsService.assignOrder(dto, user.id);
  }

  @Post('order-assignments/:id/complete') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Marks an order assignment complete' })
  completeOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: CompleteOrderAssignmentDto) {
    return this.assignmentsService.completeOrder(id, dto);
  }

  @Post('order-assignments/:id/served') @HttpCode(HttpStatus.OK) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Marks an order assignment served' })
  markServed(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.markServed(id);
  }

  @Get('order-assignments') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists active order assignments' })
  listOrderAssignments(@Query('outletId') outletId?: string) {
    return this.assignmentsService.listOrderAssignments(outletId ? Number(outletId) : undefined);
  }

  // ---- Staff dashboard ----
  @Get('staff-dashboard') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Staff dashboard aggregates (present, absent, on shift, assigned tables/orders)' })
  getStaffDashboard(@Query('outletId') outletId?: string) {
    return this.assignmentsService.getStaffDashboard(outletId ? Number(outletId) : undefined);
  }

  @Get('performance/:employeeId') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Per-employee performance statistics' })
  getPerformance(@Param('employeeId', ParseIntPipe) employeeId: number, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.assignmentsService.getPerformance(employeeId, dateFrom, dateTo);
  }
}

