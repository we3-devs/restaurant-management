import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

const EXPORT_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'action', header: 'Action' },
  { key: 'entityType', header: 'Entity Type' },
  { key: 'entityId', header: 'Entity ID' },
  { key: 'userId', header: 'User ID' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'createdAt', header: 'Date' },
];

function toCsv(rows: Record<string, unknown>[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = EXPORT_COLUMNS.map((c) => escape(c.header)).join(',');
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((c) => escape(row[c.key])).join(','),
  );
  return [header, ...lines].join('\r\n');
}

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions('audit-logs.view')
  @ApiOperation({ summary: 'Paginated, filterable audit log feed' })
  findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('export')
  @RequirePermissions('audit-logs.view')
  @ApiOperation({ summary: 'Exports the filtered audit log as CSV' })
  async export(
    @Query() query: ListAuditLogsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.auditLogsService.exportRows(query);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(toCsv(rows as unknown as Record<string, unknown>[]));
  }
}
