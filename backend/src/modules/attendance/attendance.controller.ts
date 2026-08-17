import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { ClockInDto, ClockOutDto, AdjustAttendanceDto } from './dto/attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get() @RequirePermissions('attendance.view')
  @ApiOperation({ summary: 'Lists attendance (paginated, filterable)' })
  async findAll(@Query() query: ListAttendanceQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.attendanceService.findAll(query, accessible);
  }

  @Post('clock-in') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Clocks in an employee' })
  async clockIn(@Body() dto: ClockInDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.attendanceService.clockIn(dto, user.id);
  }

  @Post('clock-out') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Clocks out an employee' })
  async clockOut(@Body() dto: ClockOutDto, @CurrentUser() user: User) {
    const attendance = await this.attendanceService.findOne(dto.attendanceId);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, attendance.outletId);
    return this.attendanceService.clockOut(dto, user.id);
  }

  @Patch(':id/adjust') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Manually adjusts an attendance record (permission protected)' })
  async adjust(@Param('id', ParseIntPipe) id: number, @Body() dto: AdjustAttendanceDto, @CurrentUser() user: User) {
    const attendance = await this.attendanceService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, attendance.outletId);
    return this.attendanceService.adjust(id, dto, user.id);
  }

  @Get('today') @RequirePermissions('attendance.view')
  @ApiOperation({ summary: "Gets today's attendance summary" })
  async getToday(@Query('outletId') outletId: string | undefined, @CurrentUser() user: User) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, parsedOutletId);
    }
    return this.attendanceService.getToday(parsedOutletId, accessible);
  }
}
