import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { OperatingHoursModule } from '../operating-hours/operating-hours.module';
import { BusinessOperationsProcessor } from './business-operations.processor';

@Module({
  imports: [
    PurchaseOrdersModule,
    ShiftsModule,
    AttendanceModule,
    SuppliersModule,
    OutletsModule,
    NotificationsModule,
    KitchenTicketsModule,
    OperatingHoursModule,
  ],
  providers: [BusinessOperationsProcessor],
})
export class BusinessOperationsModule {}
