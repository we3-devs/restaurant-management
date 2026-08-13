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
  console.log('[SETUP] Fetching outlets and dining tables for order simulation...');

  const outletsRes = http.get(`${BASE_URL}/outlets/assigned`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: LOAD_TIMEOUT,
  });

  let outlets = [];
  if (outletsRes.status === 200) {
    try {
      const body = JSON.parse(outletsRes.body);
      outlets = Array.isArray(body) ? body : body.data || [];
      console.log(`[SETUP] ✓ Found ${outlets.length} assigned outlets`);
    } catch (e) {
      console.log('[SETUP] ⚠ Could not parse outlets response, using defaults');
    }
  }

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

  return { accessToken, outlets, tables };
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

// Get a real outlet ID from setup data
function getOutletId(outlets) {
  if (!outlets || outlets.length === 0) return 1;
  return outlets[0].id;
}

// ============================================================
// ROLE WORKFLOWS
// ============================================================

// WAITER: Table → Create Order → Add Items → Send to Kitchen
function waiterWorkflow(accessToken, outlets, tables) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();
  let orderId = null;

  try {
    group('Waiter: Browse Tables', () => {
      const res = http.get(`${BASE_URL}/dining-tables`, params);
      check(res, { 'tables loaded': (r) => r.status === 200 });
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: Create Order', () => {
      const outletId = outlets && outlets.length > 0 ? outlets[0].id : 1;
      const payload = JSON.stringify({
        outletId: outletId,
        orderType: 'table',
      });

      const res = http.post(`${BASE_URL}/orders`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order created': (r) => success });
      if (success) {
        try {
          const body = JSON.parse(res.body);
          orderId = body.id;
        } catch (e) {
          // Could not parse order ID
        }
      } else {
        waiterErrors.add(1);
      }
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: Add Items to Order', () => {
      if (!orderId) {
        return;
      }
      const payload = JSON.stringify({
        foodId: 1,
        quantity: 1,
      });

      const res = http.post(`${BASE_URL}/orders/${orderId}/items`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'items added': (r) => success });
      if (!success) waiterErrors.add(1);
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: View Assigned Outlets', () => {
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

// KITCHEN: Create Order → Update Status → Mark Ready
function kitchenWorkflow(accessToken, outlets) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();
  let orderId = null;

  try {
    group('Kitchen: Get Orders', () => {
      const res = http.get(`${BASE_URL}/orders`, params);
      const success = res.status === 200;
      check(res, { 'orders loaded': (r) => success });
      if (!success) kitchenErrors.add(1);
      kitchenActions.add(1);
    });

    thinkTime();

    group('Kitchen: Create Order for Prep', () => {
      const outletId = getOutletId(outlets);
      const payload = JSON.stringify({
        outletId: outletId,
        orderType: 'table',
      });

      const res = http.post(`${BASE_URL}/orders`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order created': (r) => success });
      if (success) {
        try {
          const body = JSON.parse(res.body);
          orderId = body.id;
        } catch (e) {
          // Could not parse order ID
        }
      } else {
        kitchenErrors.add(1);
      }
      kitchenActions.add(1);
    });

    thinkTime();

    if (orderId) {
      group('Kitchen: Add Items to Order', () => {
        const payload = JSON.stringify({
          foodId: 1,
          quantity: 1,
        });

        const res = http.post(`${BASE_URL}/orders/${orderId}/items`, payload, params);
        const success = res.status >= 200 && res.status < 300;
        check(res, { 'items added': (r) => success });
        if (!success) kitchenErrors.add(1);
        kitchenActions.add(1);
      });

      thinkTime();

      group('Kitchen: Update Order Status', () => {
        const payload = JSON.stringify({ status: 'preparing' });
        const res = http.patch(`${BASE_URL}/orders/${orderId}`, payload, params);
        const success = res.status >= 200 && res.status < 300;
        check(res, { 'status updated to preparing': (r) => success });
        if (!success) kitchenErrors.add(1);
        kitchenActions.add(1);
      });
    }

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

// CASHIER: View Orders → Create Order → Mark Complete
function cashierWorkflow(accessToken, outlets) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();
  let orderId = null;

  try {
    group('Cashier: Browse Orders', () => {
      const res = http.get(`${BASE_URL}/orders`, params);
      const success = res.status === 200;
      check(res, { 'all orders loaded': (r) => success });
      if (!success) cashierErrors.add(1);
      cashierActions.add(1);
    });

    thinkTime();

    group('Cashier: Create Order for Checkout', () => {
      const outletId = getOutletId(outlets);
      const payload = JSON.stringify({
        outletId: outletId,
        orderType: 'table',
      });

      const res = http.post(`${BASE_URL}/orders`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order created': (r) => success });
      if (success) {
        try {
          const body = JSON.parse(res.body);
          orderId = body.id;
        } catch (e) {
          // Could not parse order ID
        }
      } else {
        cashierErrors.add(1);
      }
      cashierActions.add(1);
    });

    thinkTime();

    if (orderId) {
      group('Cashier: Add Items to Order', () => {
        const payload = JSON.stringify({
          foodId: 1,
          quantity: 2,
        });

        const res = http.post(`${BASE_URL}/orders/${orderId}/items`, payload, params);
        const success = res.status >= 200 && res.status < 300;
        check(res, { 'items added': (r) => success });
        if (!success) cashierErrors.add(1);
        cashierActions.add(1);
      });

      thinkTime();

      group('Cashier: Mark Order Complete', () => {
        const payload = JSON.stringify({ status: 'completed' });

        const res = http.patch(`${BASE_URL}/orders/${orderId}`, payload, params);
        const success = res.status >= 200 && res.status < 300;
        check(res, { 'order marked complete': (r) => success });
        if (!success) cashierErrors.add(1);
        cashierActions.add(1);
      });
    }

    group('Cashier: Check Assigned Outlets', () => {
      const res = http.get(`${BASE_URL}/outlets/assigned`, params);
      check(res, { 'outlets loaded': (r) => r.status === 200 });
      cashierActions.add(1);
    });

    const duration = Date.now() - startTime;
    cashierFlowDuration.add(duration);
  } catch (e) {
    cashierErrors.add(1);
    console.error(`[CASHIER] Error: ${e.message}`);
  }
}

// MANAGER: Orders → Create Order → Users → Profile
function managerWorkflow(accessToken, outlets) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const params = {
    headers,
    timeout: LOAD_TIMEOUT,
  };

  const startTime = Date.now();
  let orderId = null;

  try {
    group('Manager: View All Orders', () => {
      const res = http.get(`${BASE_URL}/orders`, params);
      const success = res.status === 200;
      check(res, { 'all orders loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: Create Order', () => {
      const outletId = getOutletId(outlets);
      const payload = JSON.stringify({
        outletId: outletId,
        orderType: 'table',
      });

      const res = http.post(`${BASE_URL}/orders`, payload, params);
      const success = res.status >= 200 && res.status < 300;
      check(res, { 'order created': (r) => success });
      if (success) {
        try {
          const body = JSON.parse(res.body);
          orderId = body.id;
        } catch (e) {
          // Could not parse order ID
        }
      } else {
        managerErrors.add(1);
      }
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: View Outlets', () => {
      const res = http.get(`${BASE_URL}/outlets`, params);
      const success = res.status === 200;
      check(res, { 'outlets loaded': (r) => success });
      if (!success) managerErrors.add(1);
      managerActions.add(1);
    });

    thinkTime();

    group('Manager: View Profile', () => {
      const res = http.get(`${BASE_URL}/auth/me`, params);
      const success = res.status === 200;
      check(res, { 'profile loaded': (r) => success });
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
  const { accessToken, outlets, tables } = data;
  const vuId = __VU; // Virtual User ID

  // Distribute roles: 25% each
  const role = vuId % 4;

  switch (role) {
    case 0:
      waiterWorkflow(accessToken, outlets, tables);
      break;
    case 1:
      kitchenWorkflow(accessToken, outlets);
      break;
    case 2:
      cashierWorkflow(accessToken, outlets);
      break;
    case 3:
      managerWorkflow(accessToken, outlets);
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
