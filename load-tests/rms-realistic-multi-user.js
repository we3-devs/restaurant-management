import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ============================================================
// CONFIGURATION
// ============================================================

const BASE_URL = __ENV.BASE_URL || 'https://restaurant-management-g6vb.onrender.com/api';
const LOAD_TIMEOUT = __ENV.LOAD_TIMEOUT || '10000ms';
const ADMIN_EMAIL = __ENV.LOAD_ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.LOAD_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('LOAD_ADMIN_EMAIL and LOAD_ADMIN_PASSWORD environment variables are required');
}

// ============================================================
// CUSTOM METRICS - ROLE & USER TRACKING
// ============================================================

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

const userAuthErrors = new Rate('user_auth_errors');
const usersAuthenticated = new Counter('users_authenticated');

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

  thresholds: {
    'http_req_failed': ['rate < 0.01'],
    'http_req_duration': ['p(95) < 2000', 'p(99) < 4000'],
    'waiter_errors': ['rate < 0.02'],
    'kitchen_errors': ['rate < 0.02'],
    'cashier_errors': ['rate < 0.02'],
    'manager_errors': ['rate < 0.02'],
    'user_auth_errors': ['rate < 0.05'],
  },
};

// ============================================================
// SETUP - AUTHENTICATE AS ADMIN & CREATE TEST ACCOUNTS
// ============================================================

export function setup() {
  console.log('[SETUP] Authenticating as admin...');

  const adminLoginPayload = JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test-multi-user',
    },
    timeout: LOAD_TIMEOUT,
  };

  const adminAuthRes = http.post(`${BASE_URL}/auth/login`, adminLoginPayload, loginParams);

  if (adminAuthRes.status !== 200 && adminAuthRes.status !== 201) {
    throw new Error(`Admin authentication failed: HTTP ${adminAuthRes.status}`);
  }

  let adminToken;
  try {
    const body = JSON.parse(adminAuthRes.body);
    adminToken = body.accessToken;
    if (!adminToken) {
      throw new Error('accessToken not found in admin login response');
    }
  } catch (e) {
    throw new Error(`Failed to parse admin login response: ${e.message}`);
  }

  console.log('[SETUP] ✓ Admin authenticated');

  // Fetch roles
  console.log('[SETUP] Fetching available roles...');

  const rolesRes = http.get(`${BASE_URL}/roles`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  if (rolesRes.status !== 200) {
    throw new Error(`Failed to fetch roles: HTTP ${rolesRes.status}`);
  }

  let roles;
  try {
    const body = JSON.parse(rolesRes.body);
    roles = body.data || [];
  } catch (e) {
    throw new Error(`Failed to parse roles response: ${e.message}`);
  }

  const roleMap = {};
  roles.forEach((role) => {
    if (['manager', 'cashier', 'waiter', 'cook'].includes(role.slug)) {
      roleMap[role.slug] = role.id;
    }
  });

  console.log(`[SETUP] Roles: Manager(${roleMap.manager}), Cashier(${roleMap.cashier}), Waiter(${roleMap.waiter}), Cook(${roleMap.cook})`);

  // Create 50 test accounts (50% waiters, 20% cashiers, 15% cooks, 15% managers)
  console.log('[SETUP] Creating 50 test accounts...');

  const testUsers = [];
  const timestamp = Math.floor(Date.now() / 1000);

  // Distribution
  const userDistribution = [
    ...Array(25).fill('waiter'),      // 25 waiters (50%)
    ...Array(10).fill('cashier'),     // 10 cashiers (20%)
    ...Array(8).fill('cook'),         // 8 cooks (16%)
    ...Array(7).fill('manager'),      // 7 managers (14%)
  ];

  for (let i = 0; i < userDistribution.length; i++) {
    const role = userDistribution[i];
    const email = `test-${role}-${timestamp}-${i}@rms.local`;

    // Create user
    const createUserPayload = JSON.stringify({
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${i}`,
      email: email,
      password: 'TestLoad123!',
    });

    const createUserRes = http.post(`${BASE_URL}/users`, createUserPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      timeout: LOAD_TIMEOUT,
    });

    if (createUserRes.status !== 200 && createUserRes.status !== 201) {
      console.log(`[SETUP] ⚠️ Failed to create ${role} user ${i}: HTTP ${createUserRes.status}`);
      continue;
    }

    let userId;
    try {
      const body = JSON.parse(createUserRes.body);
      userId = body.id;
    } catch (e) {
      console.log(`[SETUP] ⚠️ Failed to parse user creation response: ${e.message}`);
      continue;
    }

    // Assign role
    const assignRolePayload = JSON.stringify({ roleId: roleMap[role] });

    const assignRoleRes = http.post(`${BASE_URL}/users/${userId}/role-assignments`, assignRolePayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      timeout: LOAD_TIMEOUT,
    });

    if (assignRoleRes.status !== 200 && assignRoleRes.status !== 201) {
      console.log(`[SETUP] ⚠️ Failed to assign role to user ${userId}: HTTP ${assignRoleRes.status}`);
    }

    testUsers.push({
      email: email,
      password: 'TestLoad123!',
      role: role,
      userId: userId,
    });

    if ((i + 1) % 10 === 0) {
      console.log(`[SETUP] Created ${i + 1} accounts...`);
    }
  }

  console.log(`[SETUP] ✓ Created ${testUsers.length} test accounts`);
  console.log('[SETUP] Distribution:');
  console.log(`[SETUP]   Waiters:  ${testUsers.filter(u => u.role === 'waiter').length}`);
  console.log(`[SETUP]   Cashiers: ${testUsers.filter(u => u.role === 'cashier').length}`);
  console.log(`[SETUP]   Cooks:    ${testUsers.filter(u => u.role === 'cook').length}`);
  console.log(`[SETUP]   Managers: ${testUsers.filter(u => u.role === 'manager').length}`);

  console.log('[SETUP] Test configuration:');
  console.log(`[SETUP]   Base URL: ${BASE_URL}`);
  console.log(`[SETUP]   Duration: 11 minutes (ramp + sustain + ramp down)`);
  console.log(`[SETUP]   Max VUs: 50`);
  console.log(`[SETUP]   Each VU: Unique authenticated user`);
  console.log(`[SETUP]   Roles: Waiter (50%), Cashier (20%), Cook (16%), Manager (14%)`);
  console.log(`[SETUP]   Think time: 2-30 sec between actions`);

  return { testUsers, adminToken, outlets, tables, foods };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function thinkTime() {
  const seconds = Math.random() * 28 + 2;
  sleep(seconds);
}

function getRandomTable() {
  return { id: `table-${Math.floor(Math.random() * 10)}` };
}

function getRandomOrderId() {
  return `order-${Math.floor(Math.random() * 10000)}`;
}

// ============================================================
// PER-USER AUTHENTICATION
// ============================================================

function authenticateUser(user) {
  const loginPayload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test-multi-user',
    },
    timeout: LOAD_TIMEOUT,
  };

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, loginParams);

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    userAuthErrors.add(1);
    console.error(`[AUTH] Failed to authenticate ${user.email}: HTTP ${loginRes.status}`);
    return null;
  }

  let accessToken;
  try {
    const body = JSON.parse(loginRes.body);
    accessToken = body.accessToken;
    if (!accessToken) {
      userAuthErrors.add(1);
      console.error(`[AUTH] No accessToken for ${user.email}`);
      return null;
    }
  } catch (e) {
    userAuthErrors.add(1);
    console.error(`[AUTH] Failed to parse login response for ${user.email}: ${e.message}`);
    return null;
  }

  usersAuthenticated.add(1);
  return accessToken;
}

// ============================================================
// ROLE-SPECIFIC WORKFLOWS
// ============================================================

function waiterWorkflow(token, outlets, tables, foods) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
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
          // Could not parse order ID, will skip item addition
        }
      } else {
        waiterErrors.add(1);
      }
      waiterActions.add(1);
    });

    thinkTime();

    group('Waiter: Add Items to Order', () => {
      if (!orderId) {
        // Skip if order creation failed
        return;
      }

      if (!foods || foods.length === 0) {
        // No foods available
        return;
      }

      const food = foods[0];
      const payload = JSON.stringify({
        foodId: food.id,
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

function kitchenWorkflow(token) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
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

function cashierWorkflow(token) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
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

function managerWorkflow(token) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
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
// MAIN TEST LOGIC - EACH VU GETS UNIQUE USER
// ============================================================

export default function (data) {
  const { testUsers, outlets, tables, foods } = data;
  const vuId = __VU;

  // Assign user to this VU (round-robin or modulo)
  const userIndex = (vuId - 1) % testUsers.length;
  const user = testUsers[userIndex];

  // Each user authenticates independently
  const token = authenticateUser(user);

  if (!token) {
    console.error(`[VU-${vuId}] Failed to authenticate, skipping workflow`);
    return;
  }

  // User executes their role-specific workflow
  const role = user.role;

  switch (role) {
    case 'waiter':
      waiterWorkflow(token, outlets, tables, foods);
      break;
    case 'cook':
      kitchenWorkflow(token);
      break;
    case 'cashier':
      cashierWorkflow(token);
      break;
    case 'manager':
      managerWorkflow(token);
      break;
  }
}

// ============================================================
// TEARDOWN - CLEANUP
// ============================================================

export function teardown(data) {
  console.log('[TEARDOWN] Multi-user realistic load test completed');
  console.log('[TEARDOWN] Test ran with 50 unique users across 4 roles');
  console.log('[TEARDOWN] Each user authenticated independently');
}
