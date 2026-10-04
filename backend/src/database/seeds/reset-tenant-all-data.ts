import { AppDataSource } from '../data-source';

/**
 * ONE-OFF, HUMAN-REVIEWED SCRIPT. Not wired into any npm script or CI step.
 *
 * Wipes ALL data for one tenant (by slug) except the following master-data
 * modules, which are left completely untouched:
 *   - users, positions, position_permissions, permissions (roles/position)
 *   - foods and everything under the menu (categories, variants, images,
 *     combos, recipes, availability schedules)
 *   - dining_tables, table_qr_codes
 *   - dining_areas
 *   - ingredients, ingredient_categories, ingredient_variants (+ portions),
 *     units, unit_conversions, warehouses, warehouse_ingredient_stocks,
 *     ingredient_batches (current inventory state)
 *   - global_settings (also covers the QR poster template fields)
 *   - employees and their outlet/department assignments/documents
 *   - user_permission_overrides, user_resource_permissions,
 *     push_subscriptions, notification_preferences
 *   - tenants, outlets, outlet_departments, outlet_operating_hours (the
 *     scoping structure itself — never deleted)
 *
 * Everything else — orders, payments, kitchen tickets, reservations, table
 * sessions, customers (hard-deleted, including their loyalty/credit
 * history), suppliers/purchase orders/goods receiving, ingredient stock
 * movement history, analytics/dashboard caches, audit logs, sessions, etc.
 * — is deleted.
 *
 * Defaults to a DRY RUN: it only prints row counts per table. Nothing is
 * deleted until you pass --execute. Everything happens inside a single DB
 * transaction, so a failure partway through rolls back cleanly.
 *
 * Usage (run from backend/):
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/reset-tenant-all-data.ts --tenant-slug=<slug>
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/reset-tenant-all-data.ts --tenant-slug=<slug> --execute
 *
 * Make sure the DB_* env vars point at the intended environment before
 * running this — there is no environment guard here, by design, since only
 * you know which .env is loaded.
 */

const args = process.argv.slice(2);
const tenantSlugArg = args.find((arg) => arg.startsWith('--tenant-slug='));
const tenantSlug = tenantSlugArg?.slice('--tenant-slug='.length);
const execute = args.includes('--execute');

if (!tenantSlug) {
  console.error('Usage: --tenant-slug=<slug> [--execute]');
  process.exit(1);
}

// Tables guarded by the completed-order immutability trigger (see
// 1771900000000-LockCompletedOrders.ts). order_tables carries the same
// trigger and is deleted below (via cascade from orders and explicitly for
// auditability), so it must be included here too, unlike in
// reset-tenant-sales-data.ts which never touches order_tables.
const LOCKED_TABLES = [
  { table: 'order_items', trigger: 'order_items_lock_completed_order' },
  { table: 'order_payments', trigger: 'order_payments_lock_completed_order' },
  // order_tables does not exist on this schema version (confirmed via live
  // introspection) — the migration snapshot this script was modeled on is
  // ahead of/diverged from what's actually deployed, so it's left out here.
  // Deleting order_payments/order_items cascades an UPDATE on orders
  // (payment-totals sync trigger), and this script also deletes completed
  // orders directly — both hit this trigger on the orders table itself.
  { table: 'orders', trigger: 'orders_lock_completed' },
];

// [table, sql, params] — sql references $1 (outletIds) / $2 (tenantId).
// Order matters: children before the parents they reference, even though
// most of this also cascades via FK — deleting explicitly keeps an
// auditable count per table and doesn't depend on every FK being CASCADE in
// every env.
function buildDeleteSteps(outletIds: number[], tenantId: number) {
  const orderItemsSub = `SELECT id FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE outlet_id = ANY($1))`;
  const ordersSub = `SELECT id FROM orders WHERE outlet_id = ANY($1)`;
  const reservationsSub = `SELECT id FROM reservations WHERE outlet_id = ANY($1)`;
  const tableSessionsSub = `SELECT id FROM table_sessions WHERE outlet_id = ANY($1)`;
  // Scoped by tenant_id alone, not outletIds — pg can't infer the type of a
  // param that isn't referenced in the query text, so steps using only this
  // subquery (or tenantId directly) pass params: [tenantId] and use $1, not
  // the outletIds/tenantId ($1/$2) pairing used everywhere else.
  const customersSubByTenant = `SELECT id FROM customers WHERE tenant_id = $1`;
  const warehousesSub = `SELECT id FROM warehouses WHERE outlet_id = ANY($1)`;
  const purchaseOrdersSub = `SELECT id FROM purchase_orders WHERE outlet_id = ANY($1)`;
  const goodsReceivingsSub = `SELECT id FROM goods_receivings WHERE outlet_id = ANY($1)`;
  const purchaseReturnsSub = `SELECT id FROM purchase_returns WHERE outlet_id = ANY($1)`;
  const suppliersSub = `SELECT id FROM suppliers WHERE outlet_id = ANY($1)`;
  const stockTransfersSub = `SELECT id FROM ingredient_stock_transfers WHERE from_warehouse_id IN (${warehousesSub}) OR to_warehouse_id IN (${warehousesSub})`;
  const stockOutsSub = `SELECT id FROM ingredient_stock_outs WHERE warehouse_id IN (${warehousesSub})`;
  const stockInsSub = `SELECT id FROM ingredient_stock_ins WHERE warehouse_id IN (${warehousesSub})`;
  const stockAdjustmentsSub = `SELECT id FROM ingredient_stock_adjustments WHERE warehouse_id IN (${warehousesSub})`;
  const stockCountsSub = `SELECT id FROM ingredient_stock_counts WHERE warehouse_id IN (${warehousesSub})`;
  const wastagesSub = `SELECT id FROM ingredient_wastages WHERE warehouse_id IN (${warehousesSub})`;

  return [
    // --- orders / kitchen / sessions ---
    { table: 'order_item_ingredient_reservations', sql: `DELETE FROM order_item_ingredient_reservations WHERE order_item_id IN (${orderItemsSub})`, params: [outletIds] },
    { table: 'kitchen_ticket_items', sql: `DELETE FROM kitchen_ticket_items WHERE order_item_id IN (${orderItemsSub})`, params: [outletIds] },
    { table: 'table_session_food_status_counts', sql: `DELETE FROM table_session_food_status_counts WHERE order_id IN (${ordersSub})`, params: [outletIds] },
    { table: 'order_status_histories', sql: `DELETE FROM order_status_histories WHERE order_id IN (${ordersSub})`, params: [outletIds] },
    { table: 'order_assignments', sql: `DELETE FROM order_assignments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'order_payments', sql: `DELETE FROM order_payments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'notifications', sql: `DELETE FROM notifications WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'notification_issues', sql: `DELETE FROM notification_issues WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'order_items', sql: `DELETE FROM order_items WHERE order_id IN (${ordersSub})`, params: [outletIds] },
    { table: 'kitchen_tickets', sql: `DELETE FROM kitchen_tickets WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'orders', sql: `DELETE FROM orders WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'reservation_tables', sql: `DELETE FROM reservation_tables WHERE reservation_id IN (${reservationsSub})`, params: [outletIds] },
    { table: 'table_assignments', sql: `DELETE FROM table_assignments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'table_session_customers', sql: `DELETE FROM table_session_customers WHERE table_session_id IN (${tableSessionsSub})`, params: [outletIds] },
    { table: 'table_sessions', sql: `DELETE FROM table_sessions WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'reservations', sql: `DELETE FROM reservations WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'service_requests', sql: `DELETE FROM service_requests WHERE outlet_id = ANY($1)`, params: [outletIds] },

    // --- customers + their loyalty/credit history (hard delete) ---
    // customer_loyalty_accounts / customer_loyalty_point_transactions don't
    // exist on this schema version (confirmed via live introspection) — this
    // deployment only has the loyalty_accounts/loyalty_transactions pair.
    { table: 'loyalty_transactions', sql: `DELETE FROM loyalty_transactions WHERE customer_id IN (${customersSubByTenant})`, params: [tenantId] },
    { table: 'loyalty_accounts', sql: `DELETE FROM loyalty_accounts WHERE customer_id IN (${customersSubByTenant})`, params: [tenantId] },
    { table: 'customer_credit_transactions', sql: `DELETE FROM customer_credit_transactions WHERE customer_id IN (${customersSubByTenant})`, params: [tenantId] },
    { table: 'customer_credit_accounts', sql: `DELETE FROM customer_credit_accounts WHERE customer_id IN (${customersSubByTenant})`, params: [tenantId] },
    { table: 'customer_outlets', sql: `DELETE FROM customer_outlets WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'customer_refresh_tokens', sql: `DELETE FROM customer_refresh_tokens WHERE customer_id IN (${customersSubByTenant})`, params: [tenantId] },
    { table: 'customer_otps', sql: `DELETE FROM customer_otps WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'customers', sql: `DELETE FROM customers WHERE tenant_id = $1`, params: [tenantId] },

    // --- suppliers / purchasing ---
    { table: 'purchase_return_items', sql: `DELETE FROM purchase_return_items WHERE purchase_return_id IN (${purchaseReturnsSub})`, params: [outletIds] },
    { table: 'purchase_returns', sql: `DELETE FROM purchase_returns WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'goods_receiving_items', sql: `DELETE FROM goods_receiving_items WHERE goods_receiving_id IN (${goodsReceivingsSub})`, params: [outletIds] },
    { table: 'goods_receivings', sql: `DELETE FROM goods_receivings WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'purchase_order_items', sql: `DELETE FROM purchase_order_items WHERE purchase_order_id IN (${purchaseOrdersSub})`, params: [outletIds] },
    { table: 'purchase_orders', sql: `DELETE FROM purchase_orders WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'supplier_payments', sql: `DELETE FROM supplier_payments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'supplier_documents', sql: `DELETE FROM supplier_documents WHERE supplier_id IN (${suppliersSub})`, params: [outletIds] },
    { table: 'suppliers', sql: `DELETE FROM suppliers WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'supplier_categories', sql: `DELETE FROM supplier_categories WHERE tenant_id = $1`, params: [tenantId] },

    // --- ingredient stock movement / audit trail (current-state tables —
    // ingredients, warehouses, warehouse_ingredient_stocks, ingredient_batches
    // — are left untouched; this is only the history of how stock moved) ---
    { table: 'ingredient_stock_transfer_items', sql: `DELETE FROM ingredient_stock_transfer_items WHERE ingredient_stock_transfer_id IN (${stockTransfersSub})`, params: [outletIds] },
    { table: 'ingredient_stock_transfers', sql: `DELETE FROM ingredient_stock_transfers WHERE from_warehouse_id IN (${warehousesSub}) OR to_warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_stock_out_items', sql: `DELETE FROM ingredient_stock_out_items WHERE ingredient_stock_out_id IN (${stockOutsSub})`, params: [outletIds] },
    { table: 'ingredient_stock_outs', sql: `DELETE FROM ingredient_stock_outs WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_stock_in_items', sql: `DELETE FROM ingredient_stock_in_items WHERE ingredient_stock_in_id IN (${stockInsSub})`, params: [outletIds] },
    { table: 'ingredient_stock_ins', sql: `DELETE FROM ingredient_stock_ins WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_stock_adjustment_items', sql: `DELETE FROM ingredient_stock_adjustment_items WHERE ingredient_stock_adjustment_id IN (${stockAdjustmentsSub})`, params: [outletIds] },
    { table: 'ingredient_stock_adjustments', sql: `DELETE FROM ingredient_stock_adjustments WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_stock_count_items', sql: `DELETE FROM ingredient_stock_count_items WHERE ingredient_stock_count_id IN (${stockCountsSub})`, params: [outletIds] },
    { table: 'ingredient_stock_counts', sql: `DELETE FROM ingredient_stock_counts WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_wastage_items', sql: `DELETE FROM ingredient_wastage_items WHERE ingredient_wastage_id IN (${wastagesSub})`, params: [outletIds] },
    { table: 'ingredient_wastages', sql: `DELETE FROM ingredient_wastages WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },
    { table: 'ingredient_inventory_transactions', sql: `DELETE FROM ingredient_inventory_transactions WHERE warehouse_id IN (${warehousesSub})`, params: [outletIds] },

    // --- analytics / dashboard caches ---
    { table: 'analytics_daily_snapshots', sql: `DELETE FROM analytics_daily_snapshots WHERE tenant_id = $2 OR outlet_id = ANY($1)`, params: [outletIds, tenantId] },
    { table: 'daily_summaries', sql: `DELETE FROM daily_summaries WHERE outlet_id = ANY($1)`, params: [outletIds] },
    // outlet_id = 0 is a documented cross-tenant "all outlets" sentinel row —
    // ANY($1) over this tenant's real outlet ids never matches it, so it's
    // safe from accidental deletion here without special-casing it.
    { table: 'period_insights', sql: `DELETE FROM period_insights WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'period_insights_np', sql: `DELETE FROM period_insights_np WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_stats_cache', sql: `DELETE FROM dashboard_stats_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_chart_cache', sql: `DELETE FROM dashboard_chart_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_breakdown_cache', sql: `DELETE FROM dashboard_breakdown_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_inventory_cache', sql: `DELETE FROM dashboard_inventory_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },

    // --- misc / sessions / audit / imports ---
    { table: 'document_chunks', sql: `DELETE FROM document_chunks WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'assistant_documents', sql: `DELETE FROM assistant_documents WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'audit_logs', sql: `DELETE FROM audit_logs WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'refresh_tokens', sql: `DELETE FROM refresh_tokens WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'import_job_rows', sql: `DELETE FROM import_job_rows WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'import_jobs', sql: `DELETE FROM import_jobs WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'organization_assets', sql: `DELETE FROM organization_assets WHERE tenant_id = $1`, params: [tenantId] },
    { table: 'bill_number_counters', sql: `DELETE FROM bill_number_counters WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'invoice_number_counters', sql: `DELETE FROM invoice_number_counters WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'ws_tickets', sql: `DELETE FROM ws_tickets WHERE tenant_id = $1`, params: [tenantId] },
  ];
}

// Same predicate as buildDeleteSteps, but wrapped as a COUNT for the dry run.
function toCountSql(step: { sql: string }): string {
  const match = step.sql.match(/^DELETE FROM (\S+) WHERE (.*)$/s);
  if (!match) throw new Error(`Could not derive a COUNT query from: ${step.sql}`);
  const [, table, where] = match;
  return `SELECT COUNT(*) FROM ${table} WHERE ${where}`;
}

async function run() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();

  try {
    const tenant: { id: number; name: string }[] = await runner.query(
      `SELECT id, name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (tenant.length === 0) {
      console.error(`No tenant found with slug "${tenantSlug}"`);
      process.exit(1);
    }
    const tenantId = tenant[0].id;
    console.log(`Tenant: ${tenant[0].name} (id=${tenantId})`);

    const outlets: { id: number; name: string }[] = await runner.query(
      `SELECT id, name FROM outlets WHERE tenant_id = $1`,
      [tenantId],
    );
    if (outlets.length === 0) {
      console.error(`Tenant "${tenantSlug}" has no outlets — nothing to do.`);
      process.exit(1);
    }
    const outletIds = outlets.map((o) => o.id);
    console.log(`Outlets: ${outlets.map((o) => `${o.name} (id=${o.id})`).join(', ')}`);

    const steps = buildDeleteSteps(outletIds, tenantId);

    console.log('\n--- Row counts in scope ---');
    for (const step of steps) {
      const [{ count }] = await runner.query(toCountSql(step), step.params);
      console.log(`${step.table}: ${count}`);
    }

    if (!execute) {
      console.log('\nDry run only — nothing was deleted. Re-run with --execute to apply.');
      return;
    }

    console.log('\n--- Executing inside a transaction ---');
    await runner.startTransaction();
    try {
      // order_items/order_payments/order_tables are guarded by a deliberate
      // "completed orders are immutable" trigger
      // (prevent_completed_order_child_mutation, see
      // 1771900000000-LockCompletedOrders.ts) — most real sales orders are
      // 'completed', so deleting them here requires disabling it. DDL is
      // transactional in Postgres: if anything below throws, the rollback
      // also reverts these DISABLE TRIGGER statements, so the guard is only
      // ever off for the lifetime of a successfully committed run.
      for (const t of LOCKED_TABLES) {
        await runner.query(`ALTER TABLE ${t.table} DISABLE TRIGGER ${t.trigger}`);
      }

      for (const step of steps) {
        const result = await runner.query(step.sql, step.params);
        console.log(`${step.table}: done`);
        void result;
      }

      for (const t of LOCKED_TABLES) {
        await runner.query(`ALTER TABLE ${t.table} ENABLE TRIGGER ${t.trigger}`);
      }

      await runner.commitTransaction();
      console.log('\nCommitted. All tenant data cleared except master data (users, menu, tables, inventory, dining areas, roles/positions, settings, employees). Completed-order lock triggers restored.');
    } catch (error) {
      await runner.rollbackTransaction();
      console.error('\nFailed — rolled back, nothing was changed (including the trigger disables).', error);
      process.exit(1);
    }
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
