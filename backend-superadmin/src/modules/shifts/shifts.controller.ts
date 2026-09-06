import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller()
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get('shifts') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Lists shifts' })
  async findAll(@Query('outletId') outletId: string | undefined, @CurrentUser() user: User) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, parsedOutletId);
    }
    return this.shiftsService.findAll(parsedOutletId, accessible);
  }

  @Get('shifts/:id') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Gets a shift' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const shift = await this.shiftsService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return shift;
  }

  @Post('shifts') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Creates a shift' })
  async create(@Body() dto: CreateShiftDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.shiftsService.create(dto);
  }

  @Patch('shifts/:id') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Updates a shift' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShiftDto, @CurrentUser() user: User) {
    const shift = await this.shiftsService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return this.shiftsService.update(id, dto);
  }

  @Delete('shifts/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Deletes a shift' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const shift = await this.shiftsService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return this.shiftsService.remove(id);
  }

  @Post('shift-assignments') @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Assigns an employee to a shift' })
  async assignEmployee(@Body() dto: AssignShiftDto, @CurrentUser() user: User) {
    const shift = await this.shiftsService.findOne(dto.shiftId);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return this.shiftsService.assignEmployee(dto, user.id);
  }

  @Delete('shift-assignments/:id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Unassigns an employee from a shift' })
  async unassignEmployee(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const assignment = await this.shiftsService.findAssignment(id);
    const shift = await this.shiftsService.findOne(assignment.shiftId);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return this.shiftsService.unassignEmployee(id);
  }

  @Get('shifts/:id/assignments') @RequirePermissions('shifts.view')
  @ApiOperation({ summary: 'Gets shift assignments' })
  async getAssignments(@Param('id', ParseIntPipe) id: number, @Query('date') date: string | undefined, @CurrentUser() user: User) {
    const shift = await this.shiftsService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, shift.outletId);
    return this.shiftsService.getAssignments(id, date);
  }
}
