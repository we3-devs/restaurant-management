export const NOTIFICATION_TYPES = [
  "kitchen_ready",
  "kitchen_delayed",
  "kitchen_recalled",
  "kitchen_cancelled",
  "order_sent",
  "order_ready",
  "order_cancelled",
  "payment_received",
  "reservation_created",
  "reservation_cancelled",
  "reservation_reminder",
  "low_stock",
  "out_of_stock",
  "stock_adjustment",
  "service_request",
  "report_generated",
  "user_created",
  "purchase_order_approved",
  "purchase_order_rejected",
  "goods_received",
  "purchase_return",
  "supplier_payment_recorded",
  "low_supplier_credit",
  "employee_clock_in",
  "employee_late",
  "shift_started",
  "shift_ended",
  "system",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_PRIORITIES = ["normal", "high", "urgent"] as const
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number]

export const NOTIFICATION_CATEGORY_GROUPS: Record<string, NotificationType[]> = {
  Kitchen: ["kitchen_ready", "kitchen_delayed", "kitchen_recalled", "kitchen_cancelled"],
  Orders: ["order_sent", "order_ready", "order_cancelled"],
  Payments: ["payment_received"],
  Reservations: ["reservation_created", "reservation_cancelled", "reservation_reminder"],
  Inventory: ["low_stock", "out_of_stock", "stock_adjustment"],
  Procurement: [
    "purchase_order_approved",
    "purchase_order_rejected",
    "goods_received",
    "purchase_return",
    "supplier_payment_recorded",
    "low_supplier_credit",
  ],
  Staff: ["employee_clock_in", "employee_late", "shift_started", "shift_ended"],
  System: ["service_request", "report_generated", "user_created", "system"],
}

/** Toast even for the acting user's own action — everything else self-dedupes. */
export const TOAST_EVEN_IF_SELF: NotificationType[] = ["payment_received"]

export const NOTIFICATION_TOAST_VARIANT: Record<NotificationType, "success" | "error" | "warning" | "info"> = {
  kitchen_ready: "success",
  kitchen_delayed: "warning",
  kitchen_recalled: "warning",
  kitchen_cancelled: "error",
  order_sent: "info",
  order_ready: "success",
  order_cancelled: "error",
  payment_received: "success",
  reservation_created: "info",
  reservation_cancelled: "warning",
  reservation_reminder: "info",
  low_stock: "warning",
  out_of_stock: "error",
  stock_adjustment: "info",
  service_request: "info",
  report_generated: "info",
  user_created: "info",
  purchase_order_approved: "success",
  purchase_order_rejected: "error",
  goods_received: "success",
  purchase_return: "warning",
  supplier_payment_recorded: "success",
  low_supplier_credit: "warning",
  employee_clock_in: "info",
  employee_late: "warning",
  shift_started: "info",
  shift_ended: "info",
  system: "info",
}
