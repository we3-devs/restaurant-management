import { AppDataSource } from '../data-source';

/**
 * ONE-OFF, HUMAN-REVIEWED SCRIPT. Not wired into any npm script or CI step.
 *
 * Deletes all orders/order-items/payments/kitchen-tickets and cached
 * analytics/report rows for ONE tenant (by slug), leaving master data
 * (users, foods, ingredients, categories, outlets, tables, roles) untouched.
 * Loyalty/credit ledger rows are NOT deleted — only their dangling order_id
 * reference is cleared, since they're customer account history, not sales
 * data, and this repo's schema doesn't declare an FK on that column.
 *
 * Defaults to a DRY RUN: it only prints row counts per table. Nothing is
 * deleted until you pass --execute. Everything happens inside a single DB
 * transaction, so a failure partway through rolls back cleanly.
 *
 * Usage (run from backend/):
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/reset-tenant-sales-data.ts --tenant-slug=<slug>
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/reset-tenant-sales-data.ts --tenant-slug=<slug> --execute
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
// 1771900000000-LockCompletedOrders.ts) that this script's deletes hit.
// order_tables isn't touched by this script, so it's left out on purpose.
const LOCKED_TABLES = [
  { table: 'order_items', trigger: 'order_items_lock_completed_order' },
  { table: 'order_payments', trigger: 'order_payments_lock_completed_order' },
  { table: 'order_item_addons', trigger: 'order_item_addons_lock_completed_order' },
  // Deleting order_payments cascades an UPDATE orders (payment-totals sync
  // trigger), and this script also deletes completed orders directly below —
  // both hit this trigger on the orders table itself, not just its children.
  { table: 'orders', trigger: 'orders_lock_completed' },
];

// [table, whereSql, params] — whereSql references :outletIds / :tenantId,
// resolved into positional params right before each query runs. Order
// matters: children before the parents they reference, even though most of
// this also cascades via FK — deleting explicitly keeps an auditable count
// per table and doesn't depend on every FK being CASCADE in every env.
function buildDeleteSteps(outletIds: number[], tenantId: number) {
  const orderItemsSubquery = `SELECT id FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE outlet_id = ANY($1))`;
  const ordersSubquery = `SELECT id FROM orders WHERE outlet_id = ANY($1)`;

  return [
    { table: 'order_item_ingredient_reservations', sql: `DELETE FROM order_item_ingredient_reservations WHERE order_item_id IN (${orderItemsSubquery})`, params: [outletIds] },
    { table: 'order_item_addons', sql: `DELETE FROM order_item_addons WHERE order_item_id IN (${orderItemsSubquery})`, params: [outletIds] },
    { table: 'kitchen_ticket_items', sql: `DELETE FROM kitchen_ticket_items WHERE order_item_id IN (${orderItemsSubquery})`, params: [outletIds] },
    { table: 'table_session_food_status_counts', sql: `DELETE FROM table_session_food_status_counts WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'order_status_histories', sql: `DELETE FROM order_status_histories WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'loyalty_transactions (order_id cleared, rows kept)', sql: `UPDATE loyalty_transactions SET order_id = NULL WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'customer_credit_transactions (order_id cleared, rows kept)', sql: `UPDATE customer_credit_transactions SET order_id = NULL WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'order_items', sql: `DELETE FROM order_items WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'kitchen_tickets', sql: `DELETE FROM kitchen_tickets WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'order_assignments', sql: `DELETE FROM order_assignments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'order_payments', sql: `DELETE FROM order_payments WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'notifications (order-linked)', sql: `DELETE FROM notifications WHERE order_id IN (${ordersSubquery})`, params: [outletIds] },
    { table: 'orders', sql: `DELETE FROM orders WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'analytics_daily_snapshots', sql: `DELETE FROM analytics_daily_snapshots WHERE tenant_id = $2 OR outlet_id = ANY($1)`, params: [outletIds, tenantId] },
    // outlet_id = 0 is a documented cross-tenant "all outlets" sentinel row —
    // ANY($1) over this tenant's real outlet ids never matches it, so it's
    // safe from accidental deletion here without special-casing it.
    { table: 'period_insights', sql: `DELETE FROM period_insights WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'period_insights_np', sql: `DELETE FROM period_insights_np WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_stats_cache', sql: `DELETE FROM dashboard_stats_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_chart_cache', sql: `DELETE FROM dashboard_chart_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_breakdown_cache', sql: `DELETE FROM dashboard_breakdown_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
    { table: 'dashboard_inventory_cache', sql: `DELETE FROM dashboard_inventory_cache WHERE outlet_id = ANY($1)`, params: [outletIds] },
  ];
}

// Same predicate as buildDeleteSteps, but wrapped as a COUNT for the dry run.
function toCountSql(step: { sql: string }): string {
  const match = step.sql.match(/^(?:DELETE FROM|UPDATE) (\S+) SET .*? WHERE (.*)$|^DELETE FROM (\S+) WHERE (.*)$/s);
  if (!match) throw new Error(`Could not derive a COUNT query from: ${step.sql}`);
  const table = match[1] ?? match[3];
  const where = match[2] ?? match[4];
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
      // order_items/order_payments/order_item_addons are guarded by a
      // deliberate "completed orders are immutable" trigger
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
      console.log('\nCommitted. Sales/order/payment/analytics data cleared for this tenant. Completed-order lock trigger restored.');
    } catch (error) {
      await runner.rollbackTransaction();
      console.error('\nFailed — rolled back, nothing was changed (including the trigger disable).', error);
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
