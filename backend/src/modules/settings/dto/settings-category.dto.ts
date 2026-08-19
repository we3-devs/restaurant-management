import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class BusinessSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restaurantName?: string;

  // Logo is an appearance setting — see AppearanceSettingsDto.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ description: 'Freeform text, e.g. a JSON-encoded weekly schedule' })
  @IsOptional()
  @IsString()
  businessHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

const BILL_NUMBER_RESET_PERIODS = ['never', 'daily', 'monthly', 'yearly'] as const;

export class PosSettingsDto {
  @ApiPropertyOptional({
    description: "Prefix for guest-facing bill numbers, e.g. 'BILL' -> BILL-20260803-0007",
  })
  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @ApiPropertyOptional({ description: 'Zero-padding width for the sequence portion of the bill number, e.g. 4 -> 0007' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  billNumberDigits?: number;

  @ApiPropertyOptional({
    enum: BILL_NUMBER_RESET_PERIODS,
    description: 'How often the bill number sequence resets back to 1 — never, or on a daily/monthly/yearly boundary',
  })
  @IsOptional()
  @IsIn(BILL_NUMBER_RESET_PERIODS)
  billNumberResetPeriod?: (typeof BILL_NUMBER_RESET_PERIODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptFooter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptHeader?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceChargePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  defaultTaxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPaymentMethod?: string;
}

export class KitchenSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ticketTimeoutMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPriority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRouting?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  recallLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  preparationTimerMinutes?: number;
}

export class InventorySettingsDto {
  @ApiPropertyOptional({ enum: ['block', 'warn', 'allow'] })
  @IsOptional()
  @IsIn(['block', 'warn', 'allow'])
  negativeStockPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoReorder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ enum: ['fifo', 'lifo'] })
  @IsOptional()
  @IsIn(['fifo', 'lifo'])
  stockCostingMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stockPrecision?: number;
}

export class ReservationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reservationDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bufferMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cancellationWindowHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAdvanceBookingDays?: number;
}

export class LoyaltySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pointsPerCurrencyUnit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRedemptionPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRedemptionPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pointExpiryDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  welcomeBonusPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  birthdayBonusPoints?: number;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableSms?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enablePush?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kitchenDelayThresholdMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reservationReminderMinutesBefore?: number;

  /** Role slugs (e.g. 'manager', 'cashier') that receive cash-payment notifications, in addition to superadmins. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cashNotificationRoles?: string[];
}

export class AppearanceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptBrandingText?: string;
}
