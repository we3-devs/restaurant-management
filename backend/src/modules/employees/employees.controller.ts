import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { CreatePositionDto, UpdatePositionDto } from './dto/create-position.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // ---- Positions ----
  @Get('positions') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists all positions' })
  findAllPositions() { return this.employeesService.findAllPositions(); }

  @Post('positions') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Creates a position' })
  createPosition(@Body() dto: CreatePositionDto) { return this.employeesService.createPosition(dto); }

  @Patch('positions/:id') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Updates a position' })
  updatePosition(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePositionDto) { return this.employeesService.updatePosition(id, dto); }

  @Delete('positions/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Deletes a position' })
  removePosition(@Param('id', ParseIntPipe) id: number) { return this.employeesService.removePosition(id); }

  // ---- Employees ----
  @Get('employees') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Lists employees (paginated, filterable)' })
  findAll(@Query() query: ListEmployeesQueryDto) { return this.employeesService.findAll(query); }

  @Get('employees/:id') @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Gets an employee' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.employeesService.findOne(id); }

  @Post('employees') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Creates an employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: User) { return this.employeesService.create(dto, user.id); }

  @Patch('employees/:id') @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Updates an employee' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) { return this.employeesService.update(id, dto); }

  @Delete('employees/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('employees.manage')
  @ApiOperation({ summary: 'Deletes an employee' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.employeesService.remove(id); }
}
