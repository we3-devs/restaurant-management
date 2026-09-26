import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import { queryKeys } from "../query-keys"

export type SettingsCategory =
  | "business"
  | "pos"
  | "kitchen"
  | "inventory"
  | "reservation"
  | "loyalty"
  | "notification"
  | "appearance"

export interface BusinessSettings {
  restaurantName?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  vatNumber?: string
  businessHours?: string
  timezone?: string
  currency?: string
  /** Which calendar period-insight rollups/reports default to. */
  calendarSystem?: "AD" | "BS"
}

export interface PosSettings {
  /** Bill number prefix, e.g. "BILL" -> BILL-20260803-0007 — see OrdersService#generateBillNumber. */
  receiptPrefix?: string
  receiptFooter?: string
  receiptHeader?: string
  autoPrint?: boolean
  defaultPaymentMethod?: string
  /** Zero-padding width for the bill number's sequence portion, e.g. 4 -> 0007. */
  billNumberDigits?: number
  /** How often the bill number sequence resets back to 1. */
  billNumberResetPeriod?: "never" | "daily" | "monthly" | "yearly"
}

export interface KitchenSettings {
  ticketTimeoutMinutes?: number
  defaultPriority?: string
  autoRouting?: boolean
  recallLimit?: number
  preparationTimerMinutes?: number
}

export interface InventorySettings {
  negativeStockPolicy?: "block" | "warn" | "allow"
  autoReorder?: boolean
  lowStockThreshold?: number
  stockCostingMethod?: "fifo" | "lifo"
  stockPrecision?: number
}

export interface ReservationSettings {
  reservationDurationMinutes?: number
  bufferMinutes?: number
  cancellationWindowHours?: number
  maxAdvanceBookingDays?: number
}

export interface LoyaltySettings {
  pointsPerCurrencyUnit?: number
  minRedemptionPoints?: number
  maxRedemptionPercent?: number
  pointExpiryDays?: number
  welcomeBonusPoints?: number
  birthdayBonusPoints?: number
}

export interface NotificationSettings {
  enableEmail?: boolean
  enableSms?: boolean
  enablePush?: boolean
  lowStockThreshold?: number
  kitchenDelayThresholdMinutes?: number
  reservationReminderMinutesBefore?: number
  cashNotificationRoles?: string[]
  /** Position slugs (e.g. 'waiter', 'kitchen') notified when a guest places or adds to an order. */
  newOrderNotificationRoles?: string[]
  /** Position slugs notified when a guest checks in / joins a table via QR. */
  checkInNotificationRoles?: string[]
  enableNewOrderSound?: boolean
  enableCheckInSound?: boolean
}

export interface AppearanceSettings {
  logoUrl?: string
  faviconUrl?: string
  primaryColor?: string
  receiptBrandingText?: string
  qrTemplateUrl?: string
  qrTemplateQrX?: number
  qrTemplateQrY?: number
  qrTemplateQrSize?: number
  qrTemplateTableWidth?: number
  qrTemplateTableFontSize?: number
  qrTemplateTableTextColor?: string
  qrTemplateTableX?: number | null
  qrTemplateTableY?: number | null
}

export interface AllSettings {
  business: BusinessSettings
  pos: PosSettings
  kitchen: KitchenSettings
  inventory: InventorySettings
  reservation: ReservationSettings
  loyalty: LoyaltySettings
  notification: NotificationSettings
  appearance: AppearanceSettings
}

export function useAllSettings() {
  return useQuery({
    queryKey: queryKeys.settings.allCategories(),
    queryFn: () => apiClient<AllSettings>("/settings"),
  })
}

export function useSettingsCategory<T = Record<string, unknown>>(category: SettingsCategory) {
  return useQuery({
    queryKey: queryKeys.settings.category(category),
    queryFn: () => apiClient<T>(`/settings/${category}`),
    enabled: !!category,
  })
}

export interface NotificationAlertPreferences {
  enableNewOrderSound: boolean
  enableCheckInSound: boolean
}

/**
 * Unlike useSettingsCategory("notification"), not gated behind settings.view
 * — every staff member (including waiter/kitchen, who don't have that
 * permission) needs this to decide whether to play a sound on realtime
 * guest-order/check-in notifications. See useNotificationsRealtime.
 */
export function useNotificationAlertPreferences() {
  return useQuery({
    queryKey: queryKeys.settings.notificationAlertPreferences(),
    queryFn: () => apiClient<NotificationAlertPreferences>("/settings/notification/alert-preferences"),
    staleTime: 5 * 60_000,
  })
}

export interface BrandingSettings {
  restaurantName: string | null
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
}

export function useUpdateSettings<T = Record<string, unknown>>(category: SettingsCategory) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<T>) =>
      apiClient<T>(`/settings/${category}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.category(category) })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.allCategories() })
      // The sidebar logo/name read a separate public endpoint, so without this
      // they'd sit on a stale cache after a save and look like nothing applied.
      if (category === "business" || category === "appearance") {
        queryClient.invalidateQueries({ queryKey: ["branding"] })
      }
    },
  })
}
