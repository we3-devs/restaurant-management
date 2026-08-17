import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { Attendance } from './entities/attendance.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    AuthModule,
    NotificationsModule,
    KitchenTicketsModule,
    ShiftsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [TypeOrmModule, AttendanceService],
})
export class AttendanceModule {}
