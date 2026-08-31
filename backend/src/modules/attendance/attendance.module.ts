import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { OperatingHoursModule } from '../operating-hours/operating-hours.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Attendance } from './entities/attendance.entity';
import { AttendanceQrStation } from './entities/attendance-qr-station.entity';
import { Employee } from '../employees/entities/employee.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, AttendanceQrStation, Employee]),
    AuthModule,
    NotificationsModule,
    KitchenTicketsModule,
    ShiftsModule,
    OperatingHoursModule,
    AuditLogsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [TypeOrmModule, AttendanceService],
})
export class AttendanceModule {}
