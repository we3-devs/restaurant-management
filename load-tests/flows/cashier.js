import { check, sleep } from 'k6';
import { login } from '../lib/auth.js';
import { createOrder, addItem, completeOrder } from '../lib/orders.js';

// ============================================================
// FLOW TEST: CASHIER (≤5 VUs, ≤1 minute)
// ============================================================
// Cashier workflow: each iteration creates its own fresh order,
// adds an item, then marks it complete.
// Thresholds scoped ONLY to completeOrder (setup calls excluded).

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    'http_req_failed{endpoint:set_status}': ['rate<0.05'],
    'http_req_duration{endpoint:set_status}': ['p(95)<2000'],
  },
};

export default function () {
  const token = login();

  // Setup: Create fresh order for this iteration (not in threshold)
  const orderId = createOrder(token);
  if (!orderId) {
    return;
  }

  // Setup: Add item (not in threshold)
  const itemRes = addItem(token, orderId);
  if (!itemRes || itemRes.status >= 400) {
    return;
  }

  sleep(1); // Think time before completion

  // TEST: Mark order complete (THIS IS MEASURED)
  const completeRes = completeOrder(token, orderId);
  check(completeRes, {
    'order completed': (r) => r && r.status >= 200 && r.status < 300,
  });
}
