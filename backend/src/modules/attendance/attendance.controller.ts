import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { ClockInDto, ClockOutDto, AdjustAttendanceDto } from './dto/attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get() @RequirePermissions('attendance.view')
  @ApiOperation({ summary: 'Lists attendance (paginated, filterable)' })
  findAll(@Query() query: ListAttendanceQueryDto) { return this.attendanceService.findAll(query); }

  @Post('clock-in') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Clocks in an employee' })
  clockIn(@Body() dto: ClockInDto, @CurrentUser() user: User) { return this.attendanceService.clockIn(dto, user.id); }

  @Post('clock-out') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Clocks out an employee' })
  clockOut(@Body() dto: ClockOutDto, @CurrentUser() user: User) { return this.attendanceService.clockOut(dto, user.id); }

  @Patch(':id/adjust') @RequirePermissions('attendance.manage')
  @ApiOperation({ summary: 'Manually adjusts an attendance record (permission protected)' })
  adjust(@Param('id', ParseIntPipe) id: number, @Body() dto: AdjustAttendanceDto, @CurrentUser() user: User) { return this.attendanceService.adjust(id, dto, user.id); }

  @Get('today') @RequirePermissions('attendance.view')
  @ApiOperation({ summary: "Gets today's attendance summary" })
  getToday(@Query('outletId') outletId?: string) { return this.attendanceService.getToday(outletId ? Number(outletId) : undefined); }
}
