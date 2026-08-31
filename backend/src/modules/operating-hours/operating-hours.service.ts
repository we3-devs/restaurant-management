import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutletAccessService } from '../auth/outlet-access.service';
import { SettingsService } from '../settings/settings.service';
import { OutletOperatingHours } from './entities/outlet-operating-hours.entity';
import { operationalRequestContext } from './operational-request-context';
import { UpdateOperatingHoursDto } from './dto/update-operating-hours.dto';

export interface OperatingStatus {
  enabled: boolean;
  isOpen: boolean;
  openingTime: string | null;
  closingTime: string | null;
  timezone: string;
  nextOpeningAt: string | null;
  nextClosingAt: string | null;
}

function minutes(value: string): number { const [h, m] = value.slice(0, 5).split(':').map(Number); return h * 60 + m; }
function validTimezone(timezone: string): boolean { try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; } catch { return false; } }
function localParts(date: Date, timezone: string): { year: number; month: number; day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), minute: get('hour') * 60 + get('minute') };
}
function dateAtLocal(date: Date, timezone: string, targetMinutes: number, dayOffset: number): Date {
  const current = localParts(date, timezone);
  const utcGuess = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset, Math.floor(targetMinutes / 60), targetMinutes % 60));
  const actual = localParts(utcGuess, timezone);
  const targetAsUtc = Date.UTC(current.year, current.month - 1, current.day + dayOffset, Math.floor(targetMinutes / 60), targetMinutes % 60);
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, Math.floor(actual.minute / 60), actual.minute % 60);
  return new Date(utcGuess.getTime() + (targetAsUtc - actualAsUtc));
}

@Injectable()
export class OperatingHoursService {
  constructor(
    @InjectRepository(OutletOperatingHours) private readonly repo: Repository<OutletOperatingHours>,
    private readonly settingsService: SettingsService,
    private readonly outletAccess: OutletAccessService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getConfig(outletId: number): Promise<OutletOperatingHours | null> { return this.repo.findOne({ where: { outletId } }); }

  async update(outletId: number, dto: UpdateOperatingHoursDto, actorId: number): Promise<OutletOperatingHours> {
    const current = await this.repo.findOne({ where: { outletId } });
    const config = current ?? this.repo.create({ outletId, enabled: false, openingTime: null, closingTime: null, timezone: null, lastClosingBoundaryAt: null });
    Object.assign(config, dto);
    if (config.openingTime && config.closingTime && config.openingTime.slice(0, 5) === config.closingTime.slice(0, 5)) throw new BadRequestException('openingTime and closingTime must be different');
    if (config.timezone && !validTimezone(config.timezone)) throw new BadRequestException('timezone must be a valid IANA timezone');
    if (config.enabled) {
      if (!config.openingTime || !config.closingTime) throw new BadRequestException('Enabled operating hours require openingTime and closingTime');
      if (!validTimezone(config.timezone ?? '')) throw new BadRequestException('timezone must be a valid IANA timezone');
    }
    return this.repo.save(config);
  }

  async getStatus(outletId: number): Promise<OperatingStatus> {
    const config = await this.getConfig(outletId);
    const business = await this.settingsService.get('business');
    const timezone = config?.timezone ?? String(business.timezone ?? 'Asia/Kathmandu');
    if (!config?.enabled || !config.openingTime || !config.closingTime) return { enabled: false, isOpen: true, openingTime: config?.openingTime ?? null, closingTime: config?.closingTime ?? null, timezone, nextOpeningAt: null, nextClosingAt: null };
    const now = new Date(); const nowLocal = localParts(now, timezone); const open = minutes(config.openingTime); const close = minutes(config.closingTime); const overnight = close < open;
    const todayOpen = dateAtLocal(now, timezone, open, 0); const todayClose = dateAtLocal(now, timezone, close, overnight ? 1 : 0); const previousClose = dateAtLocal(now, timezone, close, overnight ? 0 : -1);
    const isOpen = overnight ? nowLocal.minute >= open || nowLocal.minute < close : nowLocal.minute >= open && nowLocal.minute < close;
    const nextOpening = isOpen ? null : (nowLocal.minute < open ? todayOpen : dateAtLocal(now, timezone, open, 1));
    const nextClosing = isOpen ? (overnight && nowLocal.minute < close ? dateAtLocal(now, timezone, close, 0) : todayClose) : null;
    void previousClose;
    return { enabled: true, isOpen, openingTime: config.openingTime.slice(0, 5), closingTime: config.closingTime.slice(0, 5), timezone, nextOpeningAt: nextOpening?.toISOString() ?? null, nextClosingAt: nextClosing?.toISOString() ?? null };
  }

  async isOpen(outletId: number): Promise<boolean> { return (await this.getStatus(outletId)).isOpen; }

  async getEnabledConfigs(): Promise<OutletOperatingHours[]> { return this.repo.find({ where: { enabled: true } }); }

  getClosingBoundary(config: OutletOperatingHours, now = new Date()): Date | null {
    if (!config.enabled || !config.openingTime || !config.closingTime) return null;
    const timezone = config.timezone ?? 'Asia/Kathmandu';
    const current = localParts(now, timezone); const open = minutes(config.openingTime); const close = minutes(config.closingTime); const overnight = close < open;
    const offset = overnight ? (current.minute >= open ? 1 : 0) : (current.minute >= close ? 0 : -1);
    return dateAtLocal(now, timezone, close, offset);
  }

  async markClosingBoundary(configId: number, boundary: Date): Promise<boolean> {
    const result = await this.repo.createQueryBuilder().update(OutletOperatingHours)
      .set({ lastClosingBoundaryAt: boundary })
      .where('id = :id AND (last_closing_boundary_at IS NULL OR last_closing_boundary_at < :boundary)', { id: configId, boundary })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  async assertOperational(outletId: number): Promise<void> {
    const context = operationalRequestContext.getStore();
    const status = await this.getStatus(outletId);
    if (status.isOpen || !status.enabled) return;
    const override = context?.overrideRequested === true;
    if (override && context?.isSuperadmin && context.userId !== null && await this.outletAccess.canAccessOutlet(context.userId, true, outletId)) {
      if (!context.overrideAudited) {
        context.overrideAudited = true;
        void this.auditLogs.record({ userId: context.userId, action: 'operational_override', entityType: 'outlet', entityId: outletId, newValues: { override: true, operation: `${context.method} ${context.path}`, outletId } });
      }
      return;
    }
    throw new ForbiddenException({ statusCode: 403, code: 'OUTLET_CLOSED', message: 'This outlet is currently closed.', outletId, opensAt: status.openingTime, timezone: status.timezone });
  }
}
