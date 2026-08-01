import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletsService } from '../outlets/outlets.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import {
  AppearanceSettingsDto,
  BusinessSettingsDto,
  InventorySettingsDto,
  KitchenSettingsDto,
  LoyaltySettingsDto,
  NotificationSettingsDto,
  PosSettingsDto,
  ReservationSettingsDto,
} from './dto/settings-category.dto';
import { GlobalSetting, SettingsCategory } from './entities/global-setting.entity';

const CACHE_TTL_SECONDS = 3600;

const CATEGORIES: SettingsCategory[] = [
  'business',
  'pos',
  'kitchen',
  'inventory',
  'reservation',
  'loyalty',
  'notification',
  'appearance',
];

const CATEGORY_DTO_MAP: Record<SettingsCategory, new () => unknown> = {
  business: BusinessSettingsDto,
  pos: PosSettingsDto,
  kitchen: KitchenSettingsDto,
  inventory: InventorySettingsDto,
  reservation: ReservationSettingsDto,
  loyalty: LoyaltySettingsDto,
  notification: NotificationSettingsDto,
  appearance: AppearanceSettingsDto,
};

const CATEGORY_DEFAULTS: Record<SettingsCategory, Record<string, unknown>> = {
  business: {
    restaurantName: 'My Restaurant',
    logoUrl: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    vatNumber: null,
    businessHours: null,
    timezone: 'Asia/Kathmandu',
    currency: 'NPR',
  },
  pos: {
    receiptPrefix: 'INV',
    receiptFooter: 'Thank you for dining with us!',
    receiptHeader: null,
    autoPrint: true,
    serviceChargePercent: 0,
    defaultTaxPercent: 0,
    defaultPaymentMethod: 'cash',
  },
  kitchen: {
    ticketTimeoutMinutes: 20,
    defaultPriority: 'normal',
    autoRouting: true,
    recallLimit: 3,
    preparationTimerMinutes: 15,
  },
  inventory: {
    negativeStockPolicy: 'warn',
    autoReorder: false,
    lowStockThreshold: 10,
    stockCostingMethod: 'fifo',
    stockPrecision: 2,
  },
  reservation: {
    reservationDurationMinutes: 90,
    bufferMinutes: 15,
    cancellationWindowHours: 2,
    maxAdvanceBookingDays: 30,
  },
  loyalty: {
    pointsPerCurrencyUnit: 1,
    minRedemptionPoints: 100,
    maxRedemptionPercent: 50,
    pointExpiryDays: 365,
    welcomeBonusPoints: 0,
    birthdayBonusPoints: 0,
  },
  notification: {
    enableEmail: true,
    enableSms: false,
    enablePush: true,
    lowStockThreshold: 10,
    kitchenDelayThresholdMinutes: 15,
    reservationReminderMinutesBefore: 60,
  },
  appearance: {
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#111827',
    receiptBrandingText: null,
  },
};

function cacheKey(category: SettingsCategory): string {
  return `settings:${category}`;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(GlobalSetting)
    private readonly settingsRepository: Repository<GlobalSetting>,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly outletsService: OutletsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private assertKnownCategory(category: string): asserts category is SettingsCategory {
    if (!CATEGORIES.includes(category as SettingsCategory)) {
      throw new BadRequestException(
        `Unknown settings category "${category}" — expected one of ${CATEGORIES.join(', ')}`,
      );
    }
  }

  async get(category: SettingsCategory): Promise<Record<string, unknown>> {
    const cached = await this.redis.get(cacheKey(category));
    if (cached) return JSON.parse(cached) as Record<string, unknown>;

    const row = await this.settingsRepository.findOne({ where: { category } });
    const merged = { ...CATEGORY_DEFAULTS[category], ...(row?.data ?? {}) };
    await this.redis.set(
      cacheKey(category),
      JSON.stringify(merged),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return merged;
  }

  async getAll(): Promise<Record<SettingsCategory, Record<string, unknown>>> {
    const entries = await Promise.all(
      CATEGORIES.map(async (category) => [category, await this.get(category)] as const),
    );
    return Object.fromEntries(entries) as Record<
      SettingsCategory,
      Record<string, unknown>
    >;
  }

  async update(
    category: SettingsCategory,
    dto: Record<string, unknown>,
    userId: number,
    ip?: string,
    userAgent?: string,
  ): Promise<Record<string, unknown>> {
    this.assertKnownCategory(category);

    let row = await this.settingsRepository.findOne({ where: { category } });
    const previousData = row?.data ?? {};
    const mergedData = { ...previousData, ...dto };

    if (!row) {
      row = this.settingsRepository.create({ category, data: mergedData });
    } else {
      row.data = mergedData;
    }
    row.updatedByUserId = userId;
    await this.settingsRepository.save(row);

    await this.redis.del(cacheKey(category));

    await this.auditLogsService.record({
      userId,
      action: 'settings_change',
      entityType: 'global_settings',
      entityId: category,
      oldValues: previousData,
      newValues: mergedData,
      ipAddress: ip,
      userAgent,
    });

    const outlets = await this.outletsService.findAll({ page: 1, limit: 1 });
    const outletId = outlets.data[0]?.id;
    if (outletId !== undefined) {
      await this.notificationsService.create({
        outletId,
        type: 'settings_changed',
        title: `Settings updated: ${category}`,
        body: `Fields changed: ${Object.keys(dto).join(', ') || 'none'}`,
        actorUserId: userId,
        data: JSON.stringify({ category, changedFields: Object.keys(dto) }),
      });
    }

    return { ...CATEGORY_DEFAULTS[category], ...mergedData };
  }

  async getBusinessSettings(): Promise<Record<string, unknown>> {
    return this.get('business');
  }

  async getPosSettings(): Promise<Record<string, unknown>> {
    return this.get('pos');
  }

  async getKitchenSettings(): Promise<Record<string, unknown>> {
    return this.get('kitchen');
  }

  async getInventorySettings(): Promise<Record<string, unknown>> {
    return this.get('inventory');
  }

  async getReservationSettings(): Promise<Record<string, unknown>> {
    return this.get('reservation');
  }

  async getLoyaltySettings(): Promise<Record<string, unknown>> {
    return this.get('loyalty');
  }

  async getNotificationSettings(): Promise<Record<string, unknown>> {
    return this.get('notification');
  }

  async getAppearanceSettings(): Promise<Record<string, unknown>> {
    return this.get('appearance');
  }
}

export { CATEGORIES as SETTINGS_CATEGORIES, CATEGORY_DTO_MAP };
