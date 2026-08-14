import { check, sleep } from 'k6';
import { login } from '../lib/auth.js';
import { createOrder, addItem, setStatus, listFoods } from '../lib/orders.js';

export function setup() {
  const token = login();
  const foodsRes = listFoods(token);
  const foods = JSON.parse(foodsRes.body);
  if (foods.data && foods.data.length > 0) {
    const foodId = foods.data[0].id;
    console.log(`[KITCHEN_SETUP] Using food ID: ${foodId}`);
    return { foodId };
  }
  throw new Error('No foods available in system');
}

// ============================================================
// FLOW TEST: KITCHEN (≤5 VUs, ≤1 minute)
// ============================================================
// Kitchen workflow: each iteration creates its own fresh order,
// adds an item, then sets status to preparing.
// Thresholds scoped ONLY to set_status (setup calls excluded).

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    'http_req_failed{endpoint:set_status}': ['rate<0.05'],
    'http_req_duration{endpoint:set_status}': ['p(95)<2000'],
  },
};

export default function (data) {
  const token = login();
  const foodId = data.foodId;

  // Setup: Create fresh order for this iteration (not in threshold)
  const orderId = createOrder(token, 11);
  if (!orderId) {
    return;
  }

  // Setup: Add item (not in threshold)
  const itemRes = addItem(token, orderId, foodId);
  if (!itemRes || itemRes.status >= 400) {
    return;
  }

  sleep(1); // Think time before status update

  // Setup: Accept order first (not in threshold)
  const acceptRes = setStatus(token, orderId, 'accepted');
  if (!acceptRes || acceptRes.status >= 400) {
    return;
  }

  // TEST: Set status to preparing (THIS IS MEASURED)
  const statusRes = setStatus(token, orderId, 'preparing');
  check(statusRes, {
    'status updated': (r) => r && r.status >= 200 && r.status < 300,
  });
}
