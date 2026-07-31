import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller()
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('shifts') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Lists shifts' })
  findAll(@Query('outletId') outletId?: string) { return this.shiftsService.findAll(outletId ? Number(outletId) : undefined); }

  @Get('shifts/:id') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Gets a shift' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.shiftsService.findOne(id); }

  @Post('shifts') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Creates a shift' })
  create(@Body() dto: CreateShiftDto) { return this.shiftsService.create(dto); }

  @Patch('shifts/:id') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Updates a shift' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShiftDto) { return this.shiftsService.update(id, dto); }

  @Delete('shifts/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Deletes a shift' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.shiftsService.remove(id); }

  @Post('shift-assignments') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Assigns an employee to a shift' })
  assignEmployee(@Body() dto: AssignShiftDto, @CurrentUser() user: User) { return this.shiftsService.assignEmployee(dto, user.id); }

  @Delete('shift-assignments/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Unassigns an employee from a shift' })
  unassignEmployee(@Param('id', ParseIntPipe) id: number) { return this.shiftsService.unassignEmployee(id); }

  @Get('shifts/:id/assignments') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Gets shift assignments' })
  getAssignments(@Param('id', ParseIntPipe) id: number, @Query('date') date?: string) { return this.shiftsService.getAssignments(id, date); }
}
