import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { Shift } from '../shifts/entities/shift.entity';
import { Attendance } from './entities/attendance.entity';
import {
  ClockInDto,
  ClockOutDto,
  AdjustAttendanceDto,
} from './dto/attendance.dto';
import { createHash, randomBytes } from 'crypto';
import { Employee } from '../employees/entities/employee.entity';
import { AttendanceQrStation } from './entities/attendance-qr-station.entity';
import { ScanAttendanceQrDto } from './dto/attendance-qr.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { OperatingHoursService } from '../operating-hours/operating-hours.service';

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    @InjectRepository(AttendanceQrStation)
    private readonly qrStationRepo: Repository<AttendanceQrStation>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly operatingHoursService: OperatingHoursService,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async setupQrCodes(outletId: number, createdBy: number) {
    const existing = await this.qrStationRepo.count({ where: { outletId } });
    if (existing > 0) throw new BadRequestException('Attendance QR codes already exist for this outlet');

    const rows = (['clock-in', 'clock-out'] as const).map((action) => {
      const token = randomBytes(32).toString('base64url');
      return { action, token, tokenHash: this.hashQrToken(token) };
    });
    await this.qrStationRepo.save(rows.map((row) => this.qrStationRepo.create({
      outletId, action: row.action, tokenHash: row.tokenHash, createdBy,
    })));
    const profileUrl = (process.env.OPERATIONAL_WEB_URL ?? process.env.FRONTEND_URL?.split(',')[0] ?? 'http://localhost:3100').replace(/\/$/, '') + '/staff/profile';
    return {
      outletId,
      clockInToken: rows[0].token,
      clockOutToken: rows[1].token,
      clockInUrl: `${profileUrl}?attendanceToken=${encodeURIComponent(rows[0].token)}`,
      clockOutUrl: `${profileUrl}?attendanceToken=${encodeURIComponent(rows[1].token)}`,
      warning: 'Save or print these QR values now. They are not returned again.',
    };
  }

  async scanQr(dto: ScanAttendanceQrDto, userId: number): Promise<Attendance> {
    const station = await this.qrStationRepo.findOne({ where: { tokenHash: this.hashQrToken(dto.token) } });
    if (!station) throw new BadRequestException('Invalid attendance QR code');
    const employee = await this.employeeRepo.findOne({ where: { userId: userId, outletId: station.outletId, isActive: true, employmentStatus: 'active' } });
    if (!employee) throw new BadRequestException('Your account is not linked to an active employee at this outlet');

    if (station.action === 'clock-in') {
      return this.clockIn({ employeeId: employee.id, outletId: station.outletId }, userId);
    }
    const attendance = await this.attendanceRepo.findOne({ where: { employeeId: employee.id, outletId: station.outletId, clockOut: IsNull() } });
    if (!attendance) throw new BadRequestException('You are not currently clocked in at this outlet');
    return this.clockOut({ attendanceId: attendance.id }, userId);
  }

  async getCurrentForUser(userId: number): Promise<Attendance | null> {
    return this.attendanceRepo.createQueryBuilder('attendance')
      .innerJoin('attendance.employee', 'employee')
      .where('employee.user_id = :userId', { userId })
      .andWhere('attendance.clock_out IS NULL')
      .andWhere("attendance.status IN ('present', 'late')")
      .orderBy('attendance.clock_in', 'DESC')
      .getOne();
  }

  async autoClockOutAtBoundary(outletId: number, boundary: Date): Promise<number> {
    const count = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Attendance);
      const rows = await repo.find({ where: { outletId, clockOut: IsNull() } });
      let closed = 0;
      for (const attendance of rows) {
        if (attendance.clockOut) continue;
        const hours = Math.max(0, (boundary.getTime() - attendance.clockIn.getTime()) / 3_600_000);
        attendance.clockOut = boundary;
        attendance.workingHours = Math.round(hours * 100) / 100;
        if (attendance.status === 'present' || attendance.status === 'late') {
          attendance.status = 'early_leave';
          attendance.isEarlyLeave = true;
        }
        await repo.save(attendance);
        closed += 1;
      }
      return closed;
    });
    if (count > 0) {
      void this.auditLogsService.record({
        userId: null,
        action: 'update',
        entityType: 'attendance',
        entityId: outletId,
        newValues: { automatic: true, reason: 'outlet_closing_boundary', outletId, boundary: boundary.toISOString(), recordsClosed: count },
      });
    }
    return count;
  }

  private hashQrToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async findAll(
    query: ListAttendanceQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<Attendance>> {
    const {
      page,
      limit,
      employeeId,
      outletId,
      shiftId,
      status,
      dateFrom,
      dateTo,
    } = query;
    const where: FindOptionsWhere<Attendance> = {};
    if (employeeId) where.employeeId = employeeId;
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (shiftId) where.shiftId = shiftId;
    if (status) where.status = status;
    if (dateFrom && dateTo) {
      where.clockIn = Between(
        new Date(dateFrom),
        new Date(`${dateTo}T23:59:59`),
      );
    }
    const [data, total] = await this.attendanceRepo.findAndCount({
      where,
      relations: ['employee'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<Attendance> {
    const a = await this.attendanceRepo.findOne({
      where: { id },
      relations: ['employee'],
    });
    if (!a) throw new NotFoundException(`Attendance ${id} not found`);
    return a;
  }

  async clockIn(dto: ClockInDto, createdBy: number): Promise<Attendance> {
    await this.operatingHoursService.assertOperational(dto.outletId);
    const existing = await this.attendanceRepo.findOne({
      where: {
        employeeId: dto.employeeId,
        outletId: dto.outletId,
        clockOut: IsNull(),
      },
    });
    if (existing)
      throw new BadRequestException(
        `Employee ${dto.employeeId} already clocked in`,
      );

    const clockIn = new Date();
    let isLate = false;
    let lateMinutes = 0;
    const shift = dto.shiftId
      ? await this.shiftRepo.findOne({ where: { id: dto.shiftId } })
      : null;
    if (shift) {
      const diff =
        minutesSinceMidnight(clockIn) - timeStringToMinutes(shift.startTime);
      if (diff > 0) {
        isLate = true;
        lateMinutes = diff;
      }
    }

    const attendance = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        employeeId: dto.employeeId,
        outletId: dto.outletId,
        shiftId: dto.shiftId ?? null,
        clockIn,
        status: isLate ? 'late' : 'present',
        isLate,
        lateMinutes,
        adjustedBy: createdBy,
      }),
    );

    const notification = await this.notificationsService.create({
      outletId: dto.outletId,
      type: isLate ? 'employee_late' : 'employee_clock_in',
      title: isLate ? 'Employee Late Arrival' : 'Employee Clocked In',
      body: isLate
        ? `Employee #${dto.employeeId} clocked in ${lateMinutes} minute(s) late`
        : `Employee #${dto.employeeId} clocked in`,
      data: JSON.stringify({
        employeeId: dto.employeeId,
        attendanceId: attendance.id,
      }),
    });
    this.gateway.notifyNotificationCreated(notification);

    return attendance;
  }

  async clockOut(dto: ClockOutDto, createdBy: number): Promise<Attendance> {
    const attendance = await this.findOne(dto.attendanceId);
    if (attendance.clockOut)
      throw new BadRequestException(
        `Attendance ${dto.attendanceId} already clocked out`,
      );

    const clockOut = new Date();
    const hours = Math.max(
      0,
      (clockOut.getTime() - attendance.clockIn.getTime()) / 3_600_000,
    );
    attendance.clockOut = clockOut;
    attendance.workingHours = Math.round(hours * 100) / 100;
    attendance.adjustedBy = createdBy;

    const shift = attendance.shiftId
      ? await this.shiftRepo.findOne({ where: { id: attendance.shiftId } })
      : null;
    if (shift) {
      const diff =
        timeStringToMinutes(shift.endTime) - minutesSinceMidnight(clockOut);
      if (diff > 0) {
        attendance.isEarlyLeave = true;
        attendance.earlyLeaveMinutes = diff;
        attendance.status = 'early_leave';
      }
    } else if (hours < 8) {
      attendance.isEarlyLeave = true;
      attendance.status = 'early_leave';
    }
    return this.attendanceRepo.save(attendance);
  }

  async adjust(
    id: number,
    dto: AdjustAttendanceDto,
    userId: number,
  ): Promise<Attendance> {
    const attendance = await this.findOne(id);
    if (dto.clockIn !== undefined) attendance.clockIn = dto.clockIn;
    if (dto.clockOut !== undefined) attendance.clockOut = dto.clockOut;
    if (dto.status !== undefined) attendance.status = dto.status;
    if (dto.notes !== undefined) attendance.notes = dto.notes;
    attendance.adjustedBy = userId;
    attendance.adjustmentReason = dto.notes ?? attendance.adjustmentReason;

    if (attendance.clockIn && attendance.clockOut) {
      attendance.workingHours =
        Math.round(
          ((attendance.clockOut.getTime() - attendance.clockIn.getTime()) /
            3_600_000) *
            100,
        ) / 100;
    }
    return this.attendanceRepo.save(attendance);
  }

  async getToday(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<{
    total: number;
    present: number;
    late: number;
    onShift: number;
    rows: Attendance[];
  }> {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    const qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .where('attendance.clock_in >= :start', { start })
      .andWhere('attendance.clock_in < :end', { end });
    if (outletId) {
      qb.andWhere('attendance.outlet_id = :outletId', { outletId });
    } else if (accessibleOutletIds !== 'ALL') {
      qb.andWhere('attendance.outlet_id IN (:...accessibleOutletIds)', {
        accessibleOutletIds,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    const present = rows.filter(
      (r) => r.status === 'present' || r.status === 'late',
    ).length;
    const late = rows.filter((r) => r.isLate).length;
    const onShift = rows.filter((r) => !r.clockOut).length;

    return { total, present, late, onShift, rows };
  }
}
