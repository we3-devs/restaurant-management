import { check, sleep } from 'k6';
import { login } from '../lib/auth.js';
import { createOrder, addItem, setStatus, completeOrder, listFoods } from '../lib/orders.js';

// Cache food ID for all VUs
let validFoodId = null;

export function setup() {
  const token = login();
  const foodsRes = listFoods(token);
  const foods = JSON.parse(foodsRes.body);
  if (foods.data && foods.data.length > 0) {
    validFoodId = foods.data[0].id;
    console.log(`[CASHIER_SETUP] Using food ID: ${validFoodId}`);
  } else {
    throw new Error('No foods available in system');
  }
  return { foodId: validFoodId };
}

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

  sleep(1); // Think time before completion

  // Setup: Accept order (not in threshold)
  const acceptRes = setStatus(token, orderId, 'accepted');
  if (!acceptRes || acceptRes.status >= 400) {
    return;
  }

  // Setup: Mark served (not in threshold)
  const servedRes = setStatus(token, orderId, 'served');
  if (!servedRes || servedRes.status >= 400) {
    return;
  }

  // TEST: Mark order complete (THIS IS MEASURED)
  const completeRes = completeOrder(token, orderId);
  check(completeRes, {
    'order completed': (r) => r && r.status >= 200 && r.status < 300,
  });
}
