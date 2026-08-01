import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api/client"
import { queryKeys } from "@/lib/query-keys"

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
  logoUrl?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  vatNumber?: string
  businessHours?: string
  timezone?: string
  currency?: string
}

export interface PosSettings {
  receiptPrefix?: string
  receiptFooter?: string
  receiptHeader?: string
  autoPrint?: boolean
  serviceChargePercent?: number
  defaultTaxPercent?: number
  defaultPaymentMethod?: string
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
}

export interface AppearanceSettings {
  logoUrl?: string
  faviconUrl?: string
  primaryColor?: string
  receiptBrandingText?: string
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

export function useUpdateSettings<T = Record<string, unknown>>(category: SettingsCategory) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<T>) =>
      apiClient<T>(`/settings/${category}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.category(category) })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.allCategories() })
    },
  })
}
