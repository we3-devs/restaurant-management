import http from 'k6/http';
import { check, group, sleep } from 'k6';

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
// EXECUTOR - SINGLE VU, ONE-TIME RUN
// ============================================================

export const options = {
  scenarios: {
    diagnostic: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
    },
  },
};

// ============================================================
// SETUP - AUTHENTICATE AS ADMIN & GET REAL DATA
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
    },
    timeout: LOAD_TIMEOUT,
  };

  const adminAuthRes = http.post(`${BASE_URL}/auth/login`, adminLoginPayload, loginParams);
  console.log(`[SETUP] Admin login: HTTP ${adminAuthRes.status}`);

  if (adminAuthRes.status !== 200 && adminAuthRes.status !== 201) {
    console.error(`[SETUP] Admin auth response body: ${adminAuthRes.body}`);
    throw new Error(`Admin authentication failed: HTTP ${adminAuthRes.status}`);
  }

  let adminToken;
  try {
    const body = JSON.parse(adminAuthRes.body);
    adminToken = body.accessToken;
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

  let roles = [];
  if (rolesRes.status === 200) {
    try {
      const body = JSON.parse(rolesRes.body);
      roles = body.data || [];
      console.log(`[SETUP] ✓ Found ${roles.length} roles`);
    } catch (e) {
      console.error(`[SETUP] Failed to parse roles: ${e.message}`);
    }
  }

  const roleMap = {};
  roles.forEach((role) => {
    roleMap[role.slug] = role.id;
  });

  // Fetch outlets
  console.log('[SETUP] Fetching outlets...');
  const outletsRes = http.get(`${BASE_URL}/outlets`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  let outlets = [];
  if (outletsRes.status === 200) {
    try {
      const body = JSON.parse(outletsRes.body);
      outlets = body.data || [];
      console.log(`[SETUP] ✓ Found ${outlets.length} outlets`);
    } catch (e) {
      console.error(`[SETUP] Failed to parse outlets: ${e.message}`);
    }
  }

  const outletId = outlets.length > 0 ? outlets[0].id : null;
  console.log(`[SETUP] Using outlet: ${outletId}`);

  // Fetch dining tables
  console.log('[SETUP] Fetching dining tables...');
  const tablesRes = http.get(`${BASE_URL}/dining-tables`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  let tables = [];
  console.log(`[SETUP] Dining tables response: HTTP ${tablesRes.status}`);
  if (tablesRes.status === 200) {
    try {
      const body = JSON.parse(tablesRes.body);
      tables = body.data || [];
      console.log(`[SETUP] ✓ Found ${tables.length} tables`);
      tables.forEach((t) => {
        console.log(`[SETUP]   Table: ${t.id} - ${t.name} (${t.status})`);
      });
    } catch (e) {
      console.error(`[SETUP] Failed to parse tables: ${e.message}`);
    }
  } else {
    console.error(`[SETUP] Failed to fetch tables. Response body: ${tablesRes.body}`);
  }

  // Fetch foods
  console.log('[SETUP] Fetching foods...');
  const foodsRes = http.get(`${BASE_URL}/foods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  let foods = [];
  console.log(`[SETUP] Foods response: HTTP ${foodsRes.status}`);
  if (foodsRes.status === 200) {
    try {
      const body = JSON.parse(foodsRes.body);
      foods = body.data || [];
      console.log(`[SETUP] ✓ Found ${foods.length} foods`);
      foods.slice(0, 3).forEach((f) => {
        console.log(`[SETUP]   Food: ${f.id} - ${f.name} (Price: ${f.price})`);
      });
    } catch (e) {
      console.error(`[SETUP] Failed to parse foods: ${e.message}`);
    }
  } else {
    console.error(`[SETUP] Failed to fetch foods. Response body: ${foodsRes.body}`);
  }

  // Create test waiter
  console.log('[SETUP] Creating test waiter account...');
  const timestamp = Math.floor(Date.now() / 1000);
  const waiterEmail = `test-waiter-diag-${timestamp}@rms.local`;

  const createUserPayload = JSON.stringify({
    name: `Diagnostic Waiter`,
    email: waiterEmail,
    password: 'TestLoad123!',
  });

  const createUserRes = http.post(`${BASE_URL}/users`, createUserPayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    timeout: LOAD_TIMEOUT,
  });

  console.log(`[SETUP] User creation response: HTTP ${createUserRes.status}`);
  console.log(`[SETUP] User creation response body: ${createUserRes.body}`);

  let userId = null;
  if (createUserRes.status === 200 || createUserRes.status === 201) {
    try {
      const body = JSON.parse(createUserRes.body);
      userId = body.id;
      console.log(`[SETUP] ✓ Created user: ${userId}`);
    } catch (e) {
      console.error(`[SETUP] Failed to parse user response: ${e.message}`);
    }
  }

  // Assign waiter role
  if (userId && roleMap.waiter) {
    console.log(`[SETUP] Assigning waiter role to user...`);
    const assignRolePayload = JSON.stringify({ roleId: roleMap.waiter });

    const assignRoleRes = http.post(`${BASE_URL}/users/${userId}/role-assignments`, assignRolePayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      timeout: LOAD_TIMEOUT,
    });

    console.log(`[SETUP] Role assignment response: HTTP ${assignRoleRes.status}`);
    console.log(`[SETUP] Role assignment response body: ${assignRoleRes.body}`);
  }

  return {
    adminToken,
    waiterEmail,
    waiterPassword: 'TestLoad123!',
    userId,
    tables,
    foods,
    outletId,
    roleMap,
  };
}

// ============================================================
// MAIN TEST - SINGLE VU, FULL WORKFLOW WITH DIAGNOSTICS
// ============================================================

export default function (data) {
  const {
    adminToken,
    waiterEmail,
    waiterPassword,
    userId,
    tables,
    foods,
  } = data;

  // Step 1: Waiter login
  console.log('\n[TEST] Step 1: Waiter Login');
  const loginPayload = JSON.stringify({
    email: waiterEmail,
    password: waiterPassword,
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: __ENV.LOAD_TIMEOUT || '10000ms',
  });

  console.log(`[TEST] Login response: HTTP ${loginRes.status}`);
  console.log(`[TEST] Login response body: ${loginRes.body}`);

  let waiterToken = null;
  if (loginRes.status === 200 || loginRes.status === 201) {
    try {
      const body = JSON.parse(loginRes.body);
      waiterToken = body.accessToken;
      console.log(`[TEST] ✓ Waiter authenticated`);
    } catch (e) {
      console.error(`[TEST] Failed to parse login response: ${e.message}`);
    }
  }

  if (!waiterToken) {
    console.error('[TEST] ✗ Waiter login failed, cannot continue');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${waiterToken}`,
  };

  const params = {
    headers,
    timeout: __ENV.LOAD_TIMEOUT || '10000ms',
  };

  // Step 2: Browse tables
  console.log('\n[TEST] Step 2: Browse Dining Tables');
  const browseTablesRes = http.get(`${BASE_URL}/dining-tables`, params);
  console.log(`[TEST] Browse tables response: HTTP ${browseTablesRes.status}`);
  console.log(`[TEST] Browse tables response body: ${browseTablesRes.body}`);

  let tableId = null;
  if (browseTablesRes.status === 200 && tables.length > 0) {
    tableId = tables[0].id;
    console.log(`[TEST] ✓ Using table: ${tableId}`);
  } else if (browseTablesRes.status === 200) {
    try {
      const body = JSON.parse(browseTablesRes.body);
      const availableTables = body.data || [];
      if (availableTables.length > 0) {
        tableId = availableTables[0].id;
        console.log(`[TEST] ✓ Found table: ${tableId}`);
      }
    } catch (e) {
      console.error(`[TEST] Failed to parse tables: ${e.message}`);
    }
  }

  // Step 3: Create order
  console.log('\n[TEST] Step 3: Create Order');
  if (!tableId) {
    console.warn('[TEST] ⚠️  No table ID available, using dummy table for testing');
    tableId = 'table-1';
  }

  const createOrderPayload = JSON.stringify({
    tableId: tableId,
    customerName: `Customer-Diagnostic-${Math.random().toString(36).substring(7)}`,
  });

  console.log(`[TEST] Creating order with payload: ${createOrderPayload}`);
  const createOrderRes = http.post(`${BASE_URL}/orders`, createOrderPayload, params);
  console.log(`[TEST] Create order response: HTTP ${createOrderRes.status}`);
  console.log(`[TEST] Create order response body: ${createOrderRes.body}`);

  let orderId = null;
  if (createOrderRes.status === 200 || createOrderRes.status === 201) {
    try {
      const body = JSON.parse(createOrderRes.body);
      orderId = body.id;
      console.log(`[TEST] ✓ Order created: ${orderId}`);
    } catch (e) {
      console.error(`[TEST] Failed to parse order response: ${e.message}`);
    }
  } else {
    console.error(`[TEST] ✗ Order creation failed with HTTP ${createOrderRes.status}`);
  }

  // Step 4: Add items to order
  if (orderId) {
    console.log('\n[TEST] Step 4: Add Items to Order');

    let itemsPayload;
    if (foods && foods.length > 0) {
      itemsPayload = JSON.stringify({
        items: [
          { foodId: foods[0].id, quantity: 1, price: foods[0].price },
        ],
      });
    } else {
      itemsPayload = JSON.stringify({
        items: [
          { foodId: 'food-1', quantity: 1, price: 450 },
        ],
      });
    }

    console.log(`[TEST] Adding items with payload: ${itemsPayload}`);
    const addItemsRes = http.post(`${BASE_URL}/orders/${orderId}/items`, itemsPayload, params);
    console.log(`[TEST] Add items response: HTTP ${addItemsRes.status}`);
    console.log(`[TEST] Add items response body: ${addItemsRes.body}`);
  } else {
    console.warn('[TEST] ⚠️  No order ID, skipping items step');
  }

  // Step 5: Get auth/me
  console.log('\n[TEST] Step 5: Get Auth/Me');
  const meRes = http.get(`${BASE_URL}/auth/me`, params);
  console.log(`[TEST] Auth/me response: HTTP ${meRes.status}`);
  console.log(`[TEST] Auth/me response body: ${meRes.body}`);

  // Step 6: List outlets
  console.log('\n[TEST] Step 6: List Outlets');
  const outletsRes = http.get(`${BASE_URL}/outlets`, params);
  console.log(`[TEST] Outlets response: HTTP ${outletsRes.status}`);
  console.log(`[TEST] Outlets response body: ${outletsRes.body}`);

  console.log('\n[TEST] ✓ Diagnostic test completed');
}

// ============================================================
// TEARDOWN
// ============================================================

export function teardown(data) {
  const { adminToken, userId } = data;

  if (userId && adminToken) {
    console.log('\n[TEARDOWN] Deactivating test user...');
    const deactivateRes = http.patch(
      `${BASE_URL}/users/${userId}`,
      JSON.stringify({ isActive: false }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        timeout: __ENV.LOAD_TIMEOUT || '10000ms',
      }
    );
    console.log(`[TEARDOWN] Deactivate response: HTTP ${deactivateRes.status}`);
  }

  console.log('[TEARDOWN] Diagnostic test teardown completed');
}
