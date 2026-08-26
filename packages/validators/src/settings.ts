import { z } from "zod"
import { toTitleCase } from "./helpers"

export const businessSettingsSchema = z.object({
  restaurantName: z.string().transform(toTitleCase).optional(),
  // Logo lives in appearance settings only — see appearanceSettingsSchema.
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  vatNumber: z.string().optional(),
  businessHours: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  calendarSystem: z.enum(["AD", "BS"]).optional(),
})

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>

export const posSettingsSchema = z.object({
  receiptPrefix: z.string().optional(),
  receiptFooter: z.string().optional(),
  receiptHeader: z.string().optional(),
  autoPrint: z.boolean().optional(),
  defaultPaymentMethod: z.string().optional(),
  billNumberDigits: z.number().optional(),
  billNumberResetPeriod: z.enum(["never", "daily", "monthly", "yearly"]).optional(),
  invoicePrefix: z.string().optional(),
  invoiceNumberDigits: z.number().optional(),
  invoiceNumberResetPeriod: z.enum(["never", "daily", "monthly", "yearly"]).optional(),
})

export type PosSettingsInput = z.infer<typeof posSettingsSchema>

export const kitchenSettingsSchema = z.object({
  ticketTimeoutMinutes: z.number().optional(),
  defaultPriority: z.string().optional(),
  autoRouting: z.boolean().optional(),
  recallLimit: z.number().optional(),
  preparationTimerMinutes: z.number().optional(),
})

export type KitchenSettingsInput = z.infer<typeof kitchenSettingsSchema>

export const INVENTORY_NEGATIVE_STOCK_POLICIES = ["block", "warn", "allow"] as const
export const INVENTORY_STOCK_COSTING_METHODS = ["fifo", "lifo"] as const

export const inventorySettingsSchema = z.object({
  negativeStockPolicy: z.enum(INVENTORY_NEGATIVE_STOCK_POLICIES).optional(),
  autoReorder: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
  stockCostingMethod: z.enum(INVENTORY_STOCK_COSTING_METHODS).optional(),
  stockPrecision: z.number().optional(),
})

export type InventorySettingsInput = z.infer<typeof inventorySettingsSchema>

export const reservationSettingsSchema = z.object({
  reservationDurationMinutes: z.number().optional(),
  bufferMinutes: z.number().optional(),
  cancellationWindowHours: z.number().optional(),
  maxAdvanceBookingDays: z.number().optional(),
})

export type ReservationSettingsInput = z.infer<typeof reservationSettingsSchema>

export const loyaltySettingsSchema = z.object({
  pointsPerCurrencyUnit: z.number().optional(),
  minRedemptionPoints: z.number().optional(),
  maxRedemptionPercent: z.number().optional(),
  pointExpiryDays: z.number().optional(),
  welcomeBonusPoints: z.number().optional(),
  birthdayBonusPoints: z.number().optional(),
})

export type LoyaltySettingsInput = z.infer<typeof loyaltySettingsSchema>

export const notificationSettingsSchema = z.object({
  enableEmail: z.boolean().optional(),
  enableSms: z.boolean().optional(),
  enablePush: z.boolean().optional(),
  lowStockThreshold: z.number().optional(),
  kitchenDelayThresholdMinutes: z.number().optional(),
  reservationReminderMinutesBefore: z.number().optional(),
  cashNotificationRoles: z.array(z.string()).optional(),
})

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>

export const appearanceSettingsSchema = z.object({
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  receiptBrandingText: z.string().optional(),
})

export type AppearanceSettingsInput = z.infer<typeof appearanceSettingsSchema>
