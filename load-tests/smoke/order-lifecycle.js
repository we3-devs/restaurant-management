import { check } from 'k6';
import { login } from '../lib/auth.js';
import { createOrder, addItem, setStatus, completeOrder } from '../lib/orders.js';

// ============================================================
// SMOKE TEST: ORDER LIFECYCLE (1 VU, 1 iteration)
// ============================================================
// Walks one order through its full lifecycle: create → add item →
// set status → mark complete. Logs the status code of EVERY step,
// even if earlier ones fail, so one run reveals exactly where it breaks.

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.00'],
  },
};

export default function () {
  console.log('[ORDER_LIFECYCLE] Starting order lifecycle smoke test...');

  let token;
  try {
    token = login();
  } catch (e) {
    console.error(`[ORDER_LIFECYCLE] ✗ Login failed: ${e.message}`);
    return;
  }

  // Step 1: Create order
  console.log('[ORDER_LIFECYCLE] Step 1: Create order');
  const orderId = createOrder(token);
  const createRes = check(orderId, {
    'create order succeeded': (id) => id !== null && id > 0,
  });
  if (createRes) {
    console.log(`[ORDER_LIFECYCLE] ✓ Order created (ID: ${orderId})`);
  } else {
    console.log(
      '[ORDER_LIFECYCLE] ✗ Create order failed - will continue to test downstream endpoints'
    );
  }

  if (!orderId) {
    console.log('[ORDER_LIFECYCLE] Skipping remaining steps due to order creation failure');
    return;
  }

  // Step 2: Add item to order
  console.log('[ORDER_LIFECYCLE] Step 2: Add item to order');
  const addItemRes = addItem(token, orderId);
  const addItemOk = check(addItemRes, {
    'add item succeeded': (r) => r && r.status >= 200 && r.status < 300,
    'add item status': (r) => r && (r.status < 200 || r.status >= 300 ? false : true),
  });
  if (addItemOk) {
    console.log(`[ORDER_LIFECYCLE] ✓ Item added (HTTP ${addItemRes.status})`);
  } else {
    console.log(
      `[ORDER_LIFECYCLE] ✗ Add item failed (HTTP ${addItemRes.status}) - will continue`
    );
  }

  // Step 3: Set status to preparing
  console.log('[ORDER_LIFECYCLE] Step 3: Set order status to preparing');
  const setStatusRes = setStatus(token, orderId, 'preparing');
  const setStatusOk = check(setStatusRes, {
    'set status succeeded': (r) => r && r.status >= 200 && r.status < 300,
    'set status code': (r) => r && (r.status < 200 || r.status >= 300 ? false : true),
  });
  if (setStatusOk) {
    console.log(`[ORDER_LIFECYCLE] ✓ Status set to preparing (HTTP ${setStatusRes.status})`);
  } else {
    console.log(
      `[ORDER_LIFECYCLE] ✗ Set status failed (HTTP ${setStatusRes.status}) - will continue`
    );
  }

  // Step 4: Mark complete
  console.log('[ORDER_LIFECYCLE] Step 4: Mark order complete');
  const completeRes = completeOrder(token, orderId);
  const completeOk = check(completeRes, {
    'complete order succeeded': (r) => r && r.status >= 200 && r.status < 300,
    'complete order status': (r) => r && (r.status < 200 || r.status >= 300 ? false : true),
  });
  if (completeOk) {
    console.log(`[ORDER_LIFECYCLE] ✓ Order completed (HTTP ${completeRes.status})`);
  } else {
    console.log(
      `[ORDER_LIFECYCLE] ✗ Complete order failed (HTTP ${completeRes.status})`
    );
  }

  console.log('[ORDER_LIFECYCLE] Order lifecycle smoke test complete');
}
