import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { ClockInDto, ClockOutDto, AdjustAttendanceDto } from './dto/attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { AttendanceService } from './attendance.service';
import { ScanAttendanceQrDto, SetupAttendanceQrDto } from './dto/attendance-qr.dto';
import { AllowWithoutPresence } from '../auth/decorators/allow-without-presence.decorator';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Post('qr/setup') @RequirePermissions('attendance.manage') @AllowWithoutPresence()
  @ApiOperation({ summary: 'Creates the permanent clock-in and clock-out QR codes for an outlet' })
  async setupQr(@Body() dto: SetupAttendanceQrDto, @CurrentUser() user: User, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    this.assertTenant(request, dto.tenantId);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.attendanceService.setupQrCodes(dto.outletId, user.id);
  }

  @Post('qr/scan')
  @ApiOperation({ summary: 'Clocks the logged-in employee in or out using an attendance QR code' })
  async scanQr(@Body() dto: ScanAttendanceQrDto, @CurrentUser() user: User) {
    return this.attendanceService.scanQr(dto, user.id);
  }

  @Get('me') @AllowWithoutPresence()
  @ApiOperation({ summary: 'Returns the logged-in staff member attendance status' })
  async myAttendance(@CurrentUser() user: User) {
    return this.attendanceService.getCurrentForUser(user.id);
  }

  @Get() @RequirePermissions('attendance.view')
  @ApiOperation({ summary: 'Lists attendance (paginated, filterable)' })
  async findAll(@Query() query: ListAttendanceQueryDto, @CurrentUser() user: User, @Req() request: AuthenticatedRequest & { tenantId?: number }) {
    const tenantId = this.assertTenant(request, query.tenantId);
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.attendanceService.findAll({ ...query, tenantId }, accessible);
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

  private assertTenant(request: AuthenticatedRequest & { tenantId?: number }, suppliedTenantId?: number): number {
    const resolvedTenantId = request.tenantId;
    if (resolvedTenantId === undefined) {
      throw new ForbiddenException('Tenant context is required for attendance');
    }
    if (suppliedTenantId !== undefined && suppliedTenantId !== resolvedTenantId) {
      throw new ForbiddenException('Tenant ID does not match the authenticated tenant context');
    }
    return resolvedTenantId;
  }
}
