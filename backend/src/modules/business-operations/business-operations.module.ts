import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutletsModule } from '../outlets/outlets.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { BusinessOperationsProcessor } from './business-operations.processor';
import { BusinessOperationsScheduler } from './business-operations.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'business-operations' }),
    PurchaseOrdersModule,
    ShiftsModule,
    AttendanceModule,
    SuppliersModule,
    OutletsModule,
    NotificationsModule,
    KitchenTicketsModule,
  ],
  providers: [BusinessOperationsProcessor, BusinessOperationsScheduler],
})
export class BusinessOperationsModule {}
