/**
 * Assistant Data Security Registry
 */

export const ASSISTANT_DATA_PERMISSIONS = {
  occupancy: [['dining-tables.view']],
  inventory: [['inventory-stock.view', 'ingredients.view', 'warehouses.view']],
  menu: [['foods.view']],
  staffSummary: [['employees.view']],
  payments: [['order-payments.view']],
  serviceIssues: [['orders.view']],
  cancellations: [['reservations.view']],
  bookings: [['reservations.view']],
  customers: [['customers.view']],
  revenue: [['dashboard.view'], ['reports.view']],
  orderDetails: [['orders.view']],
  topSelling: [['orders.view']],
  overview: [['dashboard.view'], ['reports.view']],
} as const;

export const ASSISTANT_ALLOWED_TABLES = {
  occupancy: new Set(['dining_tables', 'outlets']),
  inventory: new Set([
    'warehouse_ingredient_stocks',
    'ingredients',
    'warehouses',
  ]),
  menu: new Set(['foods']),
  staffSummary: new Set([
    'employees',
    'employee_outlet_assignments',
  ]),
  payments: new Set(['order_payments']),
  serviceIssues: new Set(['service_requests']),
  cancellations: new Set(['reservations']),
  bookings: new Set(['reservations']),
  customers: new Set(['orders']),
  revenue: new Set(['orders']),
  orderDetails: new Set(['orders', 'order_items', 'foods']),
  topSelling: new Set(['orders', 'order_items', 'foods']),
  overview: new Set(['orders']),
} as const;

export const ASSISTANT_READ_PERMISSION_SLUGS = new Set([
  'addons.view',
  'addon-groups.view',
  'attendance.view',
  'audit-logs.view',
  'customer-credit.view',
  'customers.view',
  'dining-areas.view',
  'dining-tables.view',
  'employees.view',
  'food-categories.view',
  'food-variants.view',
  'foods.view',
  'goods-receiving.view',
  'ingredient-categories.view',
  'ingredient-wastages.view',
  'ingredients.view',
  'inventory-stock.view',
  'loyalty.view',
  'order-payments.view',
  'orders.view',
  'outlet-departments.view',
  'outlets.view',
  'purchase-orders.view',
  'purchase-returns.view',
  'reports.view',
  'reservations.view',
  'service-requests.view',
  'settings.view',
  'shifts.view',
  'stock-adjustments.view',
  'stock-counts.view',
  'stock-ins.view',
  'stock-outs.view',
  'stock-transfers.view',
  'supplier-payments.view',
  'suppliers.view',
  'table-sessions.view',
  'units.view',
  'warehouses.view',
  'dashboard.view',
]);

export const ASSISTANT_BLOCKED_TABLES = new Set([
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'user_role_assignments',
  'refresh_tokens',
  'customer_refresh_tokens',
  'typeorm_migrations',
]);

type AssistantIntent = keyof typeof ASSISTANT_DATA_PERMISSIONS;

/**
 * Normalize table names:
 * public.orders -> orders
 * Orders -> orders
 * order.items -> order_items
 */
function normalizeTableName(table: string): string {
  const trimmed = table.trim().toLowerCase();

  const withoutSchema =
    trimmed.includes('.')
      ? trimmed.split('.').pop()!
      : trimmed;

  return withoutSchema.replace(/\./g, '_');
}

/**
 * Startup validation
 * Run once when app boots.
 */
export function validateAssistantRegistry(): void {
  const permissionIntents = Object.keys(
    ASSISTANT_DATA_PERMISSIONS,
  ) as AssistantIntent[];

  for (const intent of permissionIntents) {
    if (!(intent in ASSISTANT_ALLOWED_TABLES)) {
      throw new Error(
        `Missing ASSISTANT_ALLOWED_TABLES entry for intent "${intent}"`,
      );
    }

    const permissionGroups =
      ASSISTANT_DATA_PERMISSIONS[intent];

    for (const group of permissionGroups) {
      for (const permission of group) {
        if (!ASSISTANT_READ_PERMISSION_SLUGS.has(permission)) {
          throw new Error(
            `Unknown permission "${permission}" used by intent "${intent}"`,
          );
        }
      }
    }
  }
}

/**
 * Runtime validation
 */
export function assertAssistantDataAccess(
  intent: AssistantIntent,
  tables: Iterable<string>,
): void {
  if (!(intent in ASSISTANT_ALLOWED_TABLES)) {
    throw new Error(
      `Unknown assistant intent "${intent}"`,
    );
  }

  const normalized = [
    ...new Set(
      Array.from(tables)
        .map(normalizeTableName)
        .filter(Boolean),
    ),
  ];

  if (normalized.length === 0) {
    throw new Error(
      `No tables supplied for assistant intent "${intent}"`,
    );
  }

  const blocked = normalized.filter((table) =>
    ASSISTANT_BLOCKED_TABLES.has(table),
  );

  if (blocked.length > 0) {
    throw new Error(
      `Blocked table access for assistant intent "${intent}": ${blocked.join(
        ', ',
      )}`,
    );
  }

  const allowed = new Set(
    [...ASSISTANT_ALLOWED_TABLES[intent]].map((t) =>
      t.toLowerCase(),
    ),
  );

  const notAllowed = normalized.filter(
    (table) => !allowed.has(table),
  );

  if (notAllowed.length > 0) {
    throw new Error(
      `Assistant intent "${intent}" is not allowed to access table(s): ${notAllowed.join(
        ', ',
      )}`,
    );
  }
}