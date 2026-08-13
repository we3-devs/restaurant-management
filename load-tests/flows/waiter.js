import { check, sleep } from 'k6';
import { login } from '../lib/auth.js';
import { createOrder, addItem } from '../lib/orders.js';

// ============================================================
// FLOW TEST: WAITER (≤5 VUs, ≤1 minute)
// ============================================================
// Waiter workflow: create order → add 1-3 items
// Thresholds scoped only to create_order and add_item

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    'http_req_failed{endpoint:create_order}': ['rate<0.05'],
    'http_req_failed{endpoint:add_item}': ['rate<0.05'],
    'http_req_duration{endpoint:create_order}': ['p(95)<2000'],
    'http_req_duration{endpoint:add_item}': ['p(95)<2000'],
  },
};

export default function () {
  const token = login();

  // Create order
  const orderId = createOrder(token);
  const createOk = check(orderId, {
    'order created': (id) => id !== null && id > 0,
  });

  if (!createOk) {
    return;
  }

  // Add 1-3 random items
  const numItems = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < numItems; i++) {
    const itemRes = addItem(token, orderId);
    check(itemRes, {
      'item added': (r) => r && r.status >= 200 && r.status < 300,
    });
    sleep(Math.random() * 2 + 1); // 1-3 sec think time
  }
}
