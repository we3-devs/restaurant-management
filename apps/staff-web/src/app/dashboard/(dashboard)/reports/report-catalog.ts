import type { ReportType } from "@/hooks/use-reports"

/**
 * Single source of truth for the reports section: the index page, the slug
 * page's switcher and the slug validation all read from here, so adding a
 * report means one entry rather than three edits kept in sync by hand.
 *
 * Same taxonomy as the sidebar (see nav-items.ts) — Sales/Ops, Inventory,
 * Purchasing, Staff, Loyalty, System — so a report sits where you'd expect
 * to find it instead of in a flat 27-item dump.
 */
export interface ReportDefinition {
  slug: ReportType
  label: string
  /** One line on the index card saying what the report answers. */
  description: string
}

export interface ReportGroup {
  group: string
  /** Extra permission every report in the group needs, on top of `reports.view`. */
  permission?: string
  reports: ReportDefinition[]
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    group: "Sales & Service",
    reports: [
      { slug: "sales", label: "Sales", description: "Per-order revenue with discount, tax and service charge broken out." },
      { slug: "sales-items", label: "Sales Items", description: "Quantity and value sold per menu item, split by paid and unpaid." },
      { slug: "orders", label: "Orders", description: "Every order with its type, source, status and item count." },
      { slug: "payments", label: "Payments", description: "The payment ledger — method, type and amount per transaction." },
      { slug: "kitchen-performance", label: "Kitchen Performance", description: "Prep minutes and recall counts per kitchen ticket." },
      { slug: "reservations", label: "Reservations", description: "Bookings with guest counts, status and booking source." },
      { slug: "customers", label: "Customers", description: "Order counts, lifetime spend and last visit per customer." },
    ],
  },
  {
    group: "Inventory",
    reports: [
      { slug: "inventory", label: "Inventory", description: "On-hand quantity and stock value against reorder levels." },
      { slug: "stock-movements", label: "Stock Movements", description: "Every stock document — ins, outs, transfers, adjustments, wastage and counts." },
      { slug: "ingredient-consumption", label: "Ingredient Consumption", description: "How much of each ingredient orders consumed." },
      { slug: "wastage", label: "Wastage", description: "Written-off stock with quantity, cost and reason." },
    ],
  },
  {
    group: "Purchasing",
    reports: [
      { slug: "suppliers", label: "Suppliers", description: "Supplier directory with purchasing totals." },
      { slug: "purchase-orders", label: "Purchase Orders", description: "POs with supplier, status, expected delivery and value." },
      { slug: "goods-receiving", label: "Goods Receiving", description: "GRNs matched to their purchase order and warehouse." },
      { slug: "purchase-returns", label: "Purchase Returns", description: "Returns to suppliers with refund type and value." },
      { slug: "supplier-payments", label: "Supplier Payments", description: "Money paid out to suppliers, by method and status." },
    ],
  },
  {
    group: "Staff",
    permission: "staff-reports",
    reports: [
      { slug: "employees", label: "Employees", description: "Employee roster with position and employment details." },
      { slug: "attendance", label: "Attendance", description: "Clock-ins, clock-outs and hours worked." },
      { slug: "shifts", label: "Shifts", description: "Scheduled shifts and their assignments." },
      { slug: "staff-performance", label: "Staff Performance", description: "Orders handled and sales attributed per staff member." },
      { slug: "payroll-export", label: "Payroll Export", description: "Hours and pay per employee, ready to hand to payroll." },
    ],
  },
  {
    group: "Loyalty",
    reports: [
      { slug: "loyalty-top-customers", label: "Top Customers", description: "Customers ranked by loyalty points earned." },
      { slug: "loyalty-points-earned", label: "Points Earned", description: "Points accrued over the period." },
      { slug: "loyalty-points-redeemed", label: "Points Redeemed", description: "Points spent over the period." },
      { slug: "loyalty-outstanding", label: "Outstanding", description: "Unredeemed point balances still owed to customers." },
      { slug: "loyalty-transactions", label: "Transactions", description: "The raw loyalty ledger, earn and burn." },
    ],
  },
  {
    group: "System",
    reports: [
      { slug: "settings-changes", label: "Settings Changes", description: "Who changed which setting, and when." },
      { slug: "audit-logs", label: "Audit Logs", description: "Entity-level audit trail across the system." },
    ],
  },
]

const BY_SLUG = new Map<string, { definition: ReportDefinition; group: ReportGroup }>(
  REPORT_GROUPS.flatMap((group) => group.reports.map((definition) => [definition.slug, { definition, group }] as const)),
)

export function findReport(slug: string) {
  return BY_SLUG.get(slug)
}

/** What each report's `search` param actually filters by — shown as the search box placeholder so the field isn't a mystery. */
export const SEARCH_PLACEHOLDER: Record<ReportType, string> = {
  sales: "Search order #...",
  "sales-items": "Search order or item...",
  orders: "Search order #...",
  inventory: "Search ingredient...",
  "stock-movements": "Search document #...",
  "ingredient-consumption": "Search ingredient...",
  wastage: "Search ingredient...",
  "kitchen-performance": "Search order #...",
  reservations: "Search customer...",
  customers: "Search customer...",
  payments: "Search order #...",
  suppliers: "Search company...",
  "purchase-orders": "Search PO #...",
  "goods-receiving": "Search GRN #...",
  "purchase-returns": "Search return #...",
  "supplier-payments": "Search payment #...",
  employees: "Search employee...",
  attendance: "Search employee...",
  shifts: "Search shift...",
  "staff-performance": "Search employee...",
  "payroll-export": "Search employee...",
  "settings-changes": "Search category...",
  "audit-logs": "Search entity type/id...",
  "loyalty-top-customers": "Search customer...",
  "loyalty-points-earned": "Search customer...",
  "loyalty-points-redeemed": "Search customer...",
  "loyalty-outstanding": "Search customer...",
  "loyalty-transactions": "Search customer...",
}

/** stock-movements is a UNION across six document tables; movementType says which one a row came from. */
const MOVEMENT_ROUTES: Record<string, string> = {
  stock_in: "stock-ins",
  stock_out: "stock-outs",
  transfer: "stock-transfers",
  adjustment: "stock-adjustments",
  wastage: "ingredient-wastages",
  count: "stock-counts",
}

function id(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value)
  return text === "" ? null : text
}

/**
 * Which cell in a report carries a link, and where it goes. The report
 * queries select the row's id alongside its display columns purely for this
 * (the ids are not in REPORT_COLUMNS, so they stay out of the exports).
 *
 * Reports whose rows are aggregates (sales-items, ingredient-consumption,
 * the loyalty roll-ups) have no single record to open, and goods-receiving,
 * purchase-returns and supplier-payments have list pages but no detail
 * route — both stay unlinked rather than pointing somewhere wrong.
 */
export const REPORT_ROW_LINK: Partial<Record<ReportType, { column: string; href: (row: Record<string, unknown>) => string | null }>> = {
  // /dashboard/orders/:id is the hub for an order — it already shows the
  // order items, the bill receipt, the payment summary and the invoice.
  sales: { column: "orderNumber", href: (row) => (id(row.orderId) ? `/dashboard/orders/${id(row.orderId)}` : null) },
  orders: { column: "orderNumber", href: (row) => (id(row.orderId) ? `/dashboard/orders/${id(row.orderId)}` : null) },
  payments: { column: "orderNumber", href: (row) => (id(row.orderId) ? `/dashboard/orders/${id(row.orderId)}` : null) },
  "kitchen-performance": { column: "orderNumber", href: (row) => (id(row.orderId) ? `/dashboard/orders/${id(row.orderId)}` : null) },
  "purchase-orders": { column: "poNo", href: (row) => (id(row.poId) ? `/dashboard/purchase-orders/${id(row.poId)}` : null) },
  "stock-movements": {
    column: "documentNo",
    href: (row) => {
      const segment = MOVEMENT_ROUTES[String(row.movementType ?? "")]
      const documentId = id(row.documentId)
      return segment && documentId ? `/dashboard/${segment}/${documentId}` : null
    },
  },
}
