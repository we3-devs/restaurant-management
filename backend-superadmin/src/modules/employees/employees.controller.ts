import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreatePositionDto, UpdatePositionDto } from './dto/create-position.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { EmployeesService } from './employees.service';
import { AssignDepartmentDto } from './dto/assign-department.dto';
import { AssignOutletDto } from './dto/assign-outlet.dto';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('employees')
@ApiBearerAuth()
@Controller()
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  // ---- Positions ----
  @Get('positions') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists all positions' })
  findAllPositions(@Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.employeesService.findAllPositions(request.tenantId); }

  @Post('positions') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Creates a position' })
  createPosition(@Body() dto: CreatePositionDto, @Req() request: AuthenticatedRequest & { tenantId?: number }) { return this.employeesService.createPosition(dto, request.tenantId); }

  @Patch('positions/:id') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Updates a position' })
  updatePosition(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePositionDto) { return this.employeesService.updatePosition(id, dto); }

  @Delete('positions/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Deletes a position' })
  removePosition(@Param('id', ParseIntPipe) id: number) { return this.employeesService.removePosition(id); }

  // ---- Employees ----
  @Get('employees') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists employees (paginated, filterable)' })
  async findAll(@Query() query: ListEmployeesQueryDto, @CurrentUser() user: User, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.employeesService.findAll(query, accessible, request.tenantId);
  }

  @Get('employees/:id') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Gets an employee' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    return this.employeesService.findOneResponse(id);
  }

  @Post('employees') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Creates an employee' })
  async create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.employeesService.create(dto, user.id);
  }

  @Patch('employees/:id') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Updates an employee' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    if (dto.outletId !== undefined) {
      // dto.outletId can move the employee (and their synced role assignment)
      // to a different outlet — the target outlet must be checked too, or a
      // caller could transfer an employee into an outlet they don't control.
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    }
    return this.employeesService.update(id, dto);
  }

  @Delete('employees/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Deletes an employee' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    return this.employeesService.remove(id);
  }

  @Get('employees/:id/outlets') @RequirePermissions('employees.view')
  listOutlets(@Param('id', ParseIntPipe) id: number) { return this.employeesService.listOutlets(id); }

  @Post('employees/:id/outlets') @RequirePermissions('employees.manage')
  async assignOutlet(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignOutletDto, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.employeesService.assignOutlet(employee.id, dto.outletId, user.id);
  }

  @Delete('employees/:id/outlets/:outletId') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  async removeOutlet(@Param('id', ParseIntPipe) id: number, @Param('outletId', ParseIntPipe) outletId: number, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    await this.employeesService.removeOutlet(id, outletId);
  }

  @Get('employees/:id/departments') @RequirePermissions('employees.view')
  async listDepartments(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    return this.employeesService.listDepartments(id);
  }

  @Post('employees/:id/departments') @RequirePermissions('employees.manage')
  async assignDepartment(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignDepartmentDto, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    return this.employeesService.assignDepartment(id, dto.departmentId, user.id);
  }

  @Delete('employees/:id/departments/:departmentId') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  async removeDepartment(@Param('id', ParseIntPipe) id: number, @Param('departmentId', ParseIntPipe) departmentId: number, @CurrentUser() user: User) {
    const employee = await this.employeesService.findOne(id);
    await this.assertEmployeeAccess(user, employee.id);
    return this.employeesService.removeDepartment(id, departmentId);
  }

  private async assertEmployeeAccess(user: User, employeeId: number): Promise<void> {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible === 'ALL') return;
    const employeeOutlets = await this.employeesService.getOutletIds(employeeId);
    if (!employeeOutlets.some((outletId) => accessible.includes(outletId))) throw new ForbiddenException('You do not have access to this employee');
  }
}
