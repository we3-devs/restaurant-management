import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletsService } from '../outlets/outlets.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { ShiftsService } from '../shifts/shifts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { SuppliersService } from '../suppliers/suppliers.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SHIFT_REMINDER_WINDOW_MINUTES = 15;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Low-frequency procurement/staff background scans, each on its own
 * `@Interval` (replaces the old `business-operations` BullMQ queue's 6
 * repeatable jobs — same schedules, same scan logic, direct calls instead
 * of job dispatch). Kept as one class rather than one-per-scan to match how
 * sparse and lightweight each individual scan is.
 */
@Injectable()
export class BusinessOperationsProcessor {
  private readonly logger = new Logger(BusinessOperationsProcessor.name);

  constructor(
    private readonly poService: PurchaseOrdersService,
    private readonly shiftsService: ShiftsService,
    private readonly attendanceService: AttendanceService,
    private readonly suppliersService: SuppliersService,
    private readonly outletsService: OutletsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  private async guarded(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`${name} scan failed: ${(err as Error).message}`);
    }
  }

  @Interval(30 * MINUTE)
  runOverduePurchaseOrders(): Promise<void> {
    return this.guarded('overdue-purchase-orders', () => this.scanOverduePurchaseOrders());
  }

  @Interval(HOUR)
  runUpcomingDeliveries(): Promise<void> {
    return this.guarded('upcoming-deliveries', () => this.scanUpcomingDeliveries());
  }

  @Interval(15 * MINUTE)
  runShiftReminders(): Promise<void> {
    return this.guarded('shift-reminders', () => this.scanShiftReminders());
  }

  @Interval(DAY)
  runAttendanceSummaryJob(): Promise<void> {
    return this.guarded('attendance-summary', () => this.runAttendanceSummary());
  }

  @Interval(DAY)
  runDailyPurchaseSummaryJob(): Promise<void> {
    return this.guarded('daily-purchase-summary', () => this.runDailyPurchaseSummary());
  }

  @Interval(6 * HOUR)
  runOutstandingSupplierAlertsJob(): Promise<void> {
    return this.guarded('outstanding-supplier-alerts', () => this.scanOutstandingSupplierAlerts());
  }

  private async scanOverduePurchaseOrders(): Promise<void> {
    const overdue = await this.poService.findOverdue();
    for (const po of overdue) {
      const notification = await this.notificationsService.create({
        outletId: po.outletId,
        type: 'system',
        priority: 'high',
        title: `Purchase Order ${po.poNo} is overdue`,
        body: `Expected delivery was ${po.expectedDeliveryDate}, still ${po.status}`,
        data: JSON.stringify({ poId: po.id, poNo: po.poNo }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
    if (overdue.length)
      this.logger.log(`Flagged ${overdue.length} overdue purchase order(s)`);
  }

  private async scanUpcomingDeliveries(): Promise<void> {
    const upcoming = await this.poService.findUpcomingDeliveries(24);
    for (const po of upcoming) {
      const notification = await this.notificationsService.create({
        outletId: po.outletId,
        type: 'system',
        title: `Delivery expected soon - PO ${po.poNo}`,
        body: `Expected delivery on ${po.expectedDeliveryDate}`,
        data: JSON.stringify({ poId: po.id, poNo: po.poNo }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
    if (upcoming.length)
      this.logger.log(`Flagged ${upcoming.length} upcoming delivery(ies)`);
  }

  private async scanShiftReminders(): Promise<void> {
    const assignments =
      await this.shiftsService.getAssignmentsForDate(todayDateString());
    const now = new Date();
    const nowMinutes = minutesSinceMidnight(now);

    for (const assignment of assignments) {
      const shift = assignment.shift;
      if (!shift) continue;

      const startDiff = timeStringToMinutes(shift.startTime) - nowMinutes;
      if (startDiff >= 0 && startDiff < SHIFT_REMINDER_WINDOW_MINUTES) {
        const notification = await this.notificationsService.create({
          outletId: shift.outletId,
          type: 'shift_started',
          title: `Shift starting soon - ${shift.name}`,
          body: `${assignment.employee?.name ?? `Employee #${assignment.employeeId}`} is scheduled to start at ${shift.startTime}`,
          data: JSON.stringify({
            shiftId: shift.id,
            employeeId: assignment.employeeId,
          }),
        });
        this.gateway.notifyNotificationCreated(notification);
      }

      const endDiff = timeStringToMinutes(shift.endTime) - nowMinutes;
      if (endDiff >= 0 && endDiff < SHIFT_REMINDER_WINDOW_MINUTES) {
        const notification = await this.notificationsService.create({
          outletId: shift.outletId,
          type: 'shift_ended',
          title: `Shift ending soon - ${shift.name}`,
          body: `${assignment.employee?.name ?? `Employee #${assignment.employeeId}`} is scheduled to end at ${shift.endTime}`,
          data: JSON.stringify({
            shiftId: shift.id,
            employeeId: assignment.employeeId,
          }),
        });
        this.gateway.notifyNotificationCreated(notification);
      }
    }
  }

  private async runAttendanceSummary(): Promise<void> {
    const outlets = await this.outletsService.findAll({ page: 1, limit: 200 });
    for (const outlet of outlets.data) {
      const summary = await this.attendanceService.getToday(outlet.id);
      const notification = await this.notificationsService.create({
        outletId: outlet.id,
        type: 'system',
        title: `Attendance summary for ${outlet.name}`,
        body: `${summary.present} present, ${summary.late} late, ${summary.onShift} still on shift`,
        data: JSON.stringify({
          outletId: outlet.id,
          total: summary.total,
          present: summary.present,
          late: summary.late,
          onShift: summary.onShift,
        }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
  }

  private async runDailyPurchaseSummary(): Promise<void> {
    const outlets = await this.outletsService.findAll({ page: 1, limit: 200 });
    const today = todayDateString();
    const summary = await this.poService.getDailySummary(today);
    if (summary.count === 0) return;
    for (const outlet of outlets.data) {
      const notification = await this.notificationsService.create({
        outletId: outlet.id,
        type: 'system',
        title: `Daily purchase summary`,
        body: `${summary.count} purchase order(s) created today, totalling ${summary.totalValue}`,
        data: JSON.stringify(summary),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
  }

  private async scanOutstandingSupplierAlerts(): Promise<void> {
    const suppliers = await this.suppliersService.findOverCreditLimit();
    for (const supplier of suppliers) {
      const notification = await this.notificationsService.create({
        outletId: supplier.outletId,
        type: 'low_supplier_credit',
        priority: 'high',
        title: `Supplier Credit Limit Exceeded - ${supplier.companyName}`,
        body: `Outstanding balance ${supplier.outstandingBalance} exceeds credit limit ${supplier.creditLimit}`,
        data: JSON.stringify({
          supplierId: supplier.id,
          outstandingBalance: supplier.outstandingBalance,
          creditLimit: supplier.creditLimit,
        }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
    if (suppliers.length)
      this.logger.log(`${suppliers.length} supplier(s) over credit limit`);
  }
}
