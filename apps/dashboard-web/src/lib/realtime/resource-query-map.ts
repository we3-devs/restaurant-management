import { queryKeys } from "@/lib/query-keys"

type QueryKeyPrefix = readonly unknown[]

/**
 * Maps a Postgres table name (as broadcast by the backend's
 * RealtimeChangeSubscriber — see backend/src/common/subscribers/realtime-change.subscriber.ts)
 * to the TanStack Query key prefixes it should invalidate. Keys don't follow
 * a single naming convention (some plural, some singular, some grouped
 * across several tables), so this is an explicit table, not a string
 * transform.
 */
export const RESOURCE_QUERY_MAP: Record<string, QueryKeyPrefix[]> = {
  users: [queryKeys.users.all],
  roles: [queryKeys.roles.all],
  permissions: [queryKeys.permissions.all],
  role_permissions: [queryKeys.roles.all],
  user_role_assignments: [queryKeys.users.all, queryKeys.roles.all],
  customers: [queryKeys.customers.all],
  reservations: [queryKeys.reservations.all],
  outlets: [queryKeys.outlets.all],
  outlet_departments: [queryKeys.outletDepartments.all],
  warehouses: [queryKeys.warehouses.all],
  food_categories: [queryKeys.foodCategories.all],
  addon_groups: [queryKeys.addonGroups.all],
  foods: [queryKeys.foods.all],
  food_variants: [queryKeys.foodVariants.all],
  addons: [queryKeys.addons.all],
  dining_areas: [queryKeys.diningAreas.all],
  dining_tables: [queryKeys.diningTables.all],
  table_sessions: [queryKeys.tableSessions.all],
  orders: [queryKeys.orders.all, queryKeys.dashboard.all],
  order_items: [queryKeys.orders.all, queryKeys.orderItems.all],
  order_payments: [queryKeys.orders.all, queryKeys.dashboard.all],
  kitchen_tickets: [queryKeys.kitchenTickets.all],
  kitchen_ticket_items: [queryKeys.kitchenTickets.all],
  service_requests: [queryKeys.serviceRequests.all],
  units: [queryKeys.units.all],
  unit_conversions: [queryKeys.units.all],
  ingredient_categories: [queryKeys.ingredientCategories.all],
  ingredients: [queryKeys.ingredients.all],
  warehouse_ingredient_stocks: [queryKeys.warehouseIngredientStocks.all],
  ingredient_stock_ins: [queryKeys.stockIns.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  ingredient_stock_outs: [queryKeys.stockOuts.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  ingredient_stock_transfers: [queryKeys.stockTransfers.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  ingredient_stock_adjustments: [queryKeys.stockAdjustments.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  ingredient_stock_counts: [queryKeys.stockCounts.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  ingredient_wastages: [queryKeys.ingredientWastages.all, queryKeys.warehouseIngredientStocks.all, queryKeys.inventoryTransactions.all],
  supplier_categories: [queryKeys.supplierCategories.all],
  suppliers: [queryKeys.suppliers.all],
  purchase_orders: [queryKeys.purchaseOrders.all],
  purchase_order_items: [queryKeys.purchaseOrders.all],
  goods_receivings: [queryKeys.goodsReceiving.all],
  goods_receiving_items: [queryKeys.goodsReceiving.all],
  purchase_returns: [queryKeys.purchaseReturns.all],
  purchase_return_items: [queryKeys.purchaseReturns.all],
  supplier_payments: [queryKeys.supplierPayments.all],
  positions: [queryKeys.positions.all],
  employees: [queryKeys.employees.all],
  shifts: [queryKeys.shifts.all],
  shift_assignments: [queryKeys.shifts.all],
  attendance: [queryKeys.attendance.all],
  table_assignments: [queryKeys.assignments.all],
  order_assignments: [queryKeys.assignments.all],
  global_settings: [queryKeys.settings.all],
  audit_logs: [queryKeys.auditLogs.all],
  loyalty_accounts: [queryKeys.loyalty.all],
  loyalty_transactions: [queryKeys.loyalty.all],
}
