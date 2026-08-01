import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsService } from '../auth/permissions.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ListReportQueryDto } from './dto/list-report-query.dto';
import { toCsv } from './export/csv.util';
import { toExcelBuffer } from './export/excel.util';
import { toPdfBuffer } from './export/pdf.util';
import {
  REPORT_COLUMNS,
  REPORT_TYPES,
  STAFF_REPORT_TYPES,
  type ReportType,
} from './report-columns';
import { ReportsService } from './reports.service';

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

function assertReportType(type: string): asserts type is ReportType {
  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    throw new BadRequestException(
      `Unknown report type "${type}" — expected one of ${REPORT_TYPES.join(', ')}`,
    );
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly permissionsService: PermissionsService,
  ) {}

  /** Staff report types (employees, attendance, shifts, staff-performance, payroll-export) need `staff-reports` on top of the baseline `reports.view`. */
  private async assertStaffReportAccess(
    type: ReportType,
    user: User,
  ): Promise<void> {
    if (!STAFF_REPORT_TYPES.includes(type) || user.isSuperadmin) return;
    const grantedSlugs = await this.permissionsService.getPermissionSlugs(
      user.id,
    );
    if (!grantedSlugs.has('staff-reports.view')) {
      throw new BadRequestException(
        'Insufficient permissions for staff reports',
      );
    }
  }

  @Get(':type')
  @RequirePermissions('reports.view')
  @ApiOperation({
    summary:
      'Paginated report rows (sales, orders, inventory, stock-movements, ingredient-consumption, wastage, kitchen-performance, reservations, customers, payments, suppliers, purchase-orders, goods-receiving, purchase-returns, supplier-payments, employees, attendance, shifts, staff-performance, payroll-export)',
  })
  async getReport(
    @Param('type') type: string,
    @Query() query: ListReportQueryDto,
    @CurrentUser() user: User,
  ) {
    assertReportType(type);
    await this.assertStaffReportAccess(type, user);
    const report = await this.reportsService.getReport(type, query);
    return { ...report, columns: REPORT_COLUMNS[type] };
  }

  @Get(':type/export')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Exports a report as CSV, Excel, or PDF' })
  async exportReport(
    @Param('type') type: string,
    @Query() query: ListReportQueryDto,
    @Query('format') format: string | undefined,
    @Res() res: Response,
    @CurrentUser() user: User,
  ): Promise<void> {
    assertReportType(type);
    await this.assertStaffReportAccess(type, user);
    const exportFormat = (format ?? 'csv') as ExportFormat;
    if (!(EXPORT_FORMATS as readonly string[]).includes(exportFormat)) {
      throw new BadRequestException(
        `Unknown export format "${format}" — expected csv, xlsx, or pdf`,
      );
    }
    if (type === 'payroll-export' && exportFormat !== 'csv') {
      throw new BadRequestException('Payroll export is only available as CSV');
    }

    const rows = await this.reportsService.getReportRowsForExport(type, query);
    const columns = REPORT_COLUMNS[type];
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.csv"`,
      );
      res.send(toCsv(columns, rows));
    } else if (exportFormat === 'xlsx') {
      const buffer = await toExcelBuffer(type, columns, rows);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.xlsx"`,
      );
      res.send(buffer);
    } else {
      const buffer = await toPdfBuffer(`${type} report`, columns, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.pdf"`,
      );
      res.send(buffer);
    }

    // Notifications are outlet-scoped — only persist one when the export was
    // itself scoped to a single outlet (an "all outlets" export has no
    // natural outlet_id to attach the notification's FK to).
    if (query.outletId !== undefined) {
      const notification = await this.notificationsService.create({
        outletId: query.outletId,
        type: 'report_generated',
        title: `${type} report exported (${exportFormat.toUpperCase()})`,
        actorUserId: user.id,
        data: JSON.stringify({
          reportType: type,
          format: exportFormat,
          rowCount: rows.length,
        }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
  }
}
