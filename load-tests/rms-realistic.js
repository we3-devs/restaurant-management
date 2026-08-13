import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ============================================================
// CONFIGURATION
// ============================================================

const BASE_URL = __ENV.BASE_URL || 'https://restaurant-management-g6vb.onrender.com/api';
const LOAD_TIMEOUT = __ENV.LOAD_TIMEOUT || '10000ms';
const TEST_EMAIL = __ENV.LOAD_TEST_EMAIL;
const TEST_PASSWORD = __ENV.LOAD_TEST_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables are required');
}

// ============================================================
// CUSTOM METRICS - ROLE & FLOW TRACKING
// ============================================================

// Per-role metrics
const waiterFlowDuration = new Trend('waiter_flow_duration');
const kitchenFlowDuration = new Trend('kitchen_flow_duration');
const cashierFlowDuration = new Trend('cashier_flow_duration');
const managerFlowDuration = new Trend('manager_flow_duration');

const waiterErrors = new Rate('waiter_errors');
const kitchenErrors = new Rate('kitchen_errors');
const cashierErrors = new Rate('cashier_errors');
const managerErrors = new Rate('manager_errors');

const waiterActions = new Counter('waiter_actions');
const kitchenActions = new Counter('kitchen_actions');
const cashierActions = new Counter('cashier_actions');
const managerActions = new Counter('manager_actions');

// ============================================================
// EXECUTOR - RAMPING-VUS (GRADUAL USER RAMP)
// ============================================================

export const options = {
  scenarios: {
    realistic_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp to 10 users over 1 min
        { duration: '2m', target: 25 },   // Ramp to 25 users over 2 min
        { duration: '2m', target: 50 },   // Ramp to 50 users over 2 min
        { duration: '5m', target: 50 },   // Sustain 50 users for 5 min
        { duration: '1m', target: 0 },    // Ramp down to 0 over 1 min
      ],
    },
  },

  // Thresholds - realistic expectations for business workflows
  thresholds: {
    'http_req_failed': ['rate < 0.01'], // < 1% error rate
    'http_req_duration': ['p(95) < 2000', 'p(99) < 4000'], // p95 < 2s, p99 < 4s
    'waiter_errors': ['rate < 0.02'],
    'kitchen_errors': ['rate < 0.02'],
    'cashier_errors': ['rate < 0.02'],
    'manager_errors': ['rate < 0.02'],
  },
};

// ============================================================
// SETUP - AUTHENTICATE AND GET TABLES
// ============================================================

export function setup() {
  console.log('[SETUP] Authenticating test user...');

  const loginPayload = JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test-realistic',
    },
    timeout: LOAD_TIMEOUT,
  };

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Authentication failed: HTTP ${loginRes.status}`);
  }

  let accessToken;
  try {
    const body = JSON.parse(loginRes.body);
    accessToken = body.accessToken;
    if (!accessToken) {
      throw new Error('accessToken not found in login response');
    }
  } catch (e) {
    throw new Error(`Failed to parse login response: ${e.message}`);
  }

  console.log('[SETUP] ✓ Authentication successful');
  console.log('[SETUP] Fetching dining tables for order simulation...');

  const tablesRes = http.get(`${BASE_URL}/dining-tables`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: LOAD_TIMEOUT,
  });

  let tables = [];
  if (tablesRes.status === 200) {
    try {
      const body = JSON.parse(tablesRes.body);
      tables = Array.isArray(body) ? body : body.data || [];
      console.log(`[SETUP] ✓ Found ${tables.length} tables`);
    } catch (e) {
      console.log('[SETUP] ⚠ Could not parse tables response, using defaults');
    }
  }

  console.log('[SETUP] Test configuration:');
  console.log(`[SETUP]   Base URL: ${BASE_URL}`);
  console.log(`[SETUP]   Duration: 11 minutes (ramp + sustain + ramp down)`);
  console.log(`[SETUP]   Max VUs: 50`);
  console.log(`[SETUP]   Roles: 25% Waiter, 25% Kitchen, 25% Cashier, 25% Manager`);
  console.log(`[SETUP]   Think time: 2-30 sec between actions`);

  return { accessToken, tables };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Random sleep between actions (think time)
function thinkTime() {
  const seconds = Math.random() * 28 + 2; // 2-30 seconds
  sleep(seconds);
}

// Random table selection
function getRandomTable(tables) {
  if (!tables || tables.length === 0) {
    return { id: 'table-' + Math.floor(Math.random() * 10) };
  }
  return tables[Math.floor(Math.random() * tables.length)];
}

// Random order ID (simulated)
function getRandomOrderId() {
  return `order-${Math.floor(Math.random() * 10000)}`;
}

// ============================================================
// ROLE WORKFLOWS
// ============================================================

// WAITER: Table → Create Order → Add Items → Send to Kitchen
function waiterWorkflow(accessToken, tables) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();

  try {
    group('Waiter: Browse Tables', () => {
      const res = http.get(`${BASE_URL}/dining-tables`, params);
      check(res, { 'tables loaded': (r) => r.status === 200 });
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: Create Order', () => {
      const table = getRandomTable(tables);
      const payload = JSON.stringify({
        tableId: table.id || 'table-1',
        customerName: `Customer-${Math.random().toString(36).substring(7)}`,
      });

      const res = http.post(`${BASE_URL}/orders`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order created': (r) => success });
      if (!success) waiterErrors.add(1);
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: Add Items to Order', () => {
      const orderId = getRandomOrderId();
      const payload = JSON.stringify({
        items: [
          { name: 'Pasta', quantity: 2, price: 450 },
          { name: 'Soda', quantity: 2, price: 150 },
        ],
      });

      const res = http.post(`${BASE_URL}/orders/${orderId}/items`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'items added': (r) => success });
      if (!success) waiterErrors.add(1);
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: View Outlets', () => {
      const res = http.get(`${BASE_URL}/outlets/assigned`, params);
      check(res, { 'outlets loaded': (r) => r.status === 200 });
      waiterActions.add(1);
    });

    const duration = Date.now() - startTime;
    waiterFlowDuration.add(duration);
  } catch (e) {
    waiterErrors.add(1);
    console.error(`[WAITER] Error: ${e.message}`);
  }
}

// KITCHEN: Get Tickets → Update Status → Mark Ready
function kitchenWorkflow(accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();

  try {
    group('Kitchen: Get Tickets', () => {
      const res = http.get(`${BASE_URL}/kitchen/tickets`, params);
      const success = res.status === 200;
      check(res, { 'tickets fetched': (r) => success });
      if (!success) kitchenErrors.add(1);
      kitchenActions.add(1);
    });

    thinkTime();

    group('Kitchen: Mark Order Preparing', () => {
      const orderId = getRandomOrderId();
      const payload = JSON.stringify({ status: 'preparing' });

      const res = http.patch(`${BASE_URL}/kitchen/tickets/${orderId}`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'status updated to preparing': (r) => success });
      if (!success) kitchenErrors.add(1);
      kitchenActions.add(1);
    });

    thinkTime();

    group('Kitchen: Mark Order Ready', () => {
      const orderId = getRandomOrderId();
      const payload = JSON.stringify({ status: 'ready' });

      const res = http.patch(`${BASE_URL}/kitchen/tickets/${orderId}`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'status updated to ready': (r) => success });
      if (!success) kitchenErrors.add(1);
      kitchenActions.add(1);
    });

    thinkTime();

    group('Kitchen: Check My Profile', () => {
      const res = http.get(`${BASE_URL}/auth/me`, params);
      check(res, { 'profile loaded': (r) => r.status === 200 });
      kitchenActions.add(1);
    });

    const duration = Date.now() - startTime;
    kitchenFlowDuration.add(duration);
  } catch (e) {
    kitchenErrors.add(1);
    console.error(`[KITCHEN] Error: ${e.message}`);
  }
}

// CASHIER: View Orders → Process Payment → Generate Bill
function cashierWorkflow(accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();

  try {
    group('Cashier: Browse Orders', () => {
      const res = http.get(`${BASE_URL}/orders`, params);
      const success = res.status === 200;
      check(res, { 'orders loaded': (r) => success });
      if (!success) cashierErrors.add(1);
      cashierActions.add(1);
    });

    thinkTime();

    group('Cashier: Generate Bill', () => {
      const orderId = getRandomOrderId();
      const res = http.get(`${BASE_URL}/orders/${orderId}/bill`, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'bill generated': (r) => success });
      if (!success) cashierErrors.add(1);
      cashierActions.add(1);
    });

    thinkTime();

    group('Cashier: Process Payment', () => {
      const orderId = getRandomOrderId();
      const payload = JSON.stringify({
        amount: Math.random() * 5000 + 500,
        method: ['cash', 'card', 'upi'][Math.floor(Math.random() * 3)],
      });

      const res = http.post(`${BASE_URL}/payments`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'payment processed': (r) => success });
      if (!success) cashierErrors.add(1);
      cashierActions.add(1);
    });

    thinkTime();

    group('Cashier: Mark Order Complete', () => {
      const orderId = getRandomOrderId();
      const payload = JSON.stringify({ status: 'completed' });

      const res = http.patch(`${BASE_URL}/orders/${orderId}`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order marked complete': (r) => success });
      if (!success) cashierErrors.add(1);
      cashierActions.add(1);
    });

    const duration = Date.now() - startTime;
    cashierFlowDuration.add(duration);
  } catch (e) {
    cashierErrors.add(1);
    console.error(`[CASHIER] Error: ${e.message}`);
  }
}

// MANAGER: Dashboard → Reports → Inventory → Orders
function managerWorkflow(accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();

  try {
    group('Manager: View Dashboard', () => {
      const res = http.get(`${BASE_URL}/dashboard`, params);
      const success = res.status === 200;
      check(res, { 'dashboard loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: View Reports', () => {
      const res = http.get(`${BASE_URL}/reports?period=today`, params);
      const success = res.status === 200;
      check(res, { 'reports loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: Check Inventory', () => {
      const res = http.get(`${BASE_URL}/inventory`, params);
      const success = res.status === 200;
      check(res, { 'inventory loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: View All Orders', () => {
      const res = http.get(`${BASE_URL}/orders?status=all`, params);
      const success = res.status === 200;
      check(res, { 'all orders loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    const duration = Date.now() - startTime;
    managerFlowDuration.add(duration);
  } catch (e) {
    managerErrors.add(1);
    console.error(`[MANAGER] Error: ${e.message}`);
  }
}

// ============================================================
// MAIN TEST LOGIC - ASSIGN ROLES EVENLY
// ============================================================

export default function (data) {
  const { accessToken, tables } = data;
  const vuId = __VU; // Virtual User ID

  // Distribute roles: 25% each
  const role = vuId % 4;

  switch (role) {
    case 0:
      waiterWorkflow(accessToken, tables);
      break;
    case 1:
      kitchenWorkflow(accessToken);
      break;
    case 2:
      cashierWorkflow(accessToken);
      break;
    case 3:
      managerWorkflow(accessToken);
      break;
  }
}

// ============================================================
// TEARDOWN
// ============================================================

export function teardown() {
  console.log('[TEARDOWN] Realistic load test completed');
  console.log('[TEARDOWN] Test ran 50 VUs with role-based workflows and think time');
}
