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
  console.log('[SETUP] ========================================');
  console.log('[SETUP] Starting diagnostic test setup...');
  console.log('[SETUP] ========================================');

  // Step 1: Admin authentication
  console.log('\n[SETUP] Step 1: Authenticating as admin...');
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

  // Step 2: Fetch roles
  console.log('[SETUP] Step 2: Fetching available roles...');
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

  if (!roleMap.waiter) {
    throw new Error('Waiter role not found');
  }
  console.log(`[SETUP] ✓ Waiter role ID: ${roleMap.waiter}`);

  // Step 3: Fetch outlets
  console.log('[SETUP] Step 3: Fetching outlets...');
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

  const outletId = 11; // Hardcoded: table 23 belongs to outlet 11
  const selectedOutlet = outlets.find(o => o.id === outletId);
  if (!selectedOutlet) {
    throw new Error(`Outlet ${outletId} not found in fetched outlets`);
  }
  console.log(`[SETUP] ✓ Using outlet ${outletId}: ${selectedOutlet.name}`);

  // Step 4: Fetch dining tables
  console.log('[SETUP] Step 4: Fetching dining tables...');
  const tablesRes = http.get(`${BASE_URL}/dining-tables`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  let tables = [];
  if (tablesRes.status === 200) {
    try {
      const body = JSON.parse(tablesRes.body);
      tables = body.data || [];
      console.log(`[SETUP] ✓ Found ${tables.length} tables`);
    } catch (e) {
      console.error(`[SETUP] Failed to parse tables: ${e.message}`);
    }
  }

  const tableId = 23; // Hardcoded: table 23 belongs to outlet 11
  const selectedTable = tables.find(t => t.id === tableId);
  if (!selectedTable) {
    throw new Error(`Table ${tableId} not found in fetched tables`);
  }

  if (selectedTable.outletId !== outletId) {
    throw new Error(
      `Table ${tableId} belongs to outlet ${selectedTable.outletId}, ` +
      `but expected outlet ${outletId}`
    );
  }

  console.log(`[SETUP] ✓ Using table ${tableId} (${selectedTable.name}) ` +
              `from outlet ${outletId}`);

  // Step 5: Fetch foods
  console.log('[SETUP] Step 5: Fetching foods...');
  const foodsRes = http.get(`${BASE_URL}/foods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: LOAD_TIMEOUT,
  });

  let foods = [];
  if (foodsRes.status === 200) {
    try {
      const body = JSON.parse(foodsRes.body);
      foods = body.data || [];
      console.log(`[SETUP] ✓ Found ${foods.length} foods`);
      if (foods.length > 0) {
        console.log(`[SETUP]   First food: ID ${foods[0].id}, ${foods[0].name}`);
      }
    } catch (e) {
      console.error(`[SETUP] Failed to parse foods: ${e.message}`);
    }
  }

  if (foods.length === 0) {
    throw new Error('No foods available');
  }

  const selectedFood = foods[0];
  console.log(`[SETUP] ✓ Using food ID ${selectedFood.id}: ${selectedFood.name}`);

  // Step 6: Create test waiter account
  console.log('[SETUP] Step 6: Creating test waiter account...');
  const timestamp = Math.floor(Date.now() / 1000);
  const waiterEmail = `test-waiter-diag-${timestamp}@rms.local`;

  const createUserPayload = JSON.stringify({
    name: `Diagnostic Waiter ${timestamp}`,
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

  let userId = null;
  if (createUserRes.status === 200 || createUserRes.status === 201) {
    try {
      const body = JSON.parse(createUserRes.body);
      userId = body.id;
      console.log(`[SETUP] ✓ Created waiter user ID: ${userId}`);
    } catch (e) {
      console.error(`[SETUP] Failed to parse user response: ${e.message}`);
    }
  } else {
    console.error(`[SETUP] User creation failed: ${createUserRes.body}`);
    throw new Error(`Failed to create user: HTTP ${createUserRes.status}`);
  }

  // Step 7: Assign waiter role
  console.log('[SETUP] Step 7: Assigning waiter role to user...');
  const assignRolePayload = JSON.stringify({ roleId: roleMap.waiter });

  const assignRoleRes = http.post(`${BASE_URL}/users/${userId}/role-assignments`, assignRolePayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    timeout: LOAD_TIMEOUT,
  });

  console.log(`[SETUP] Role assignment response: HTTP ${assignRoleRes.status}`);
  if (assignRoleRes.status !== 200 && assignRoleRes.status !== 201 && assignRoleRes.status !== 204) {
    console.error(`[SETUP] Role assignment failed: ${assignRoleRes.body}`);
  }

  console.log('[SETUP] ✓ Waiter role assigned');

  console.log('\n[SETUP] ========================================');
  console.log('[SETUP] Setup complete. Data summary:');
  console.log(`[SETUP]   Outlet: ${outletId} (${selectedOutlet.name})`);
  console.log(`[SETUP]   Table: ${tableId} (${selectedTable.name})`);
  console.log(`[SETUP]   Food: ${selectedFood.id} (${selectedFood.name})`);
  console.log(`[SETUP]   Waiter: ${waiterEmail} (ID: ${userId})`);
  console.log('[SETUP] ========================================\n');

  return {
    adminToken,
    userId,
    waiterEmail,
    waiterPassword: 'TestLoad123!',
    outletId,
    tableId,
    selectedFood,
  };
}

// ============================================================
// MAIN TEST - SINGLE VU, FULL WORKFLOW WITH DIAGNOSTICS
// ============================================================

export default function (data) {
  const {
    waiterEmail,
    waiterPassword,
    outletId,
    tableId,
    selectedFood,
  } = data;

  console.log('\n[TEST] ========================================');
  console.log('[TEST] Starting end-to-end diagnostic workflow...');
  console.log('[TEST] ========================================\n');

  // Step 1: Waiter login
  console.log('[TEST] Step 1: Waiter Login');
  const loginPayload = JSON.stringify({
    email: waiterEmail,
    password: waiterPassword,
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: __ENV.LOAD_TIMEOUT || '10000ms',
  });

  console.log(`[TEST] Login response: HTTP ${loginRes.status}`);

  let waiterToken = null;
  if (loginRes.status === 200 || loginRes.status === 201) {
    try {
      const body = JSON.parse(loginRes.body);
      waiterToken = body.accessToken;
      console.log('[TEST] ✓ Waiter authenticated');
    } catch (e) {
      console.error(`[TEST] Failed to parse login response: ${e.message}`);
      throw new Error('Failed to authenticate waiter');
    }
  } else {
    console.error(`[TEST] Login failed: ${loginRes.body}`);
    throw new Error(`Waiter login failed: HTTP ${loginRes.status}`);
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

  if (browseTablesRes.status !== 200) {
    console.error(`[TEST] Failed to fetch tables: ${browseTablesRes.body}`);
    throw new Error(`Browse tables failed: HTTP ${browseTablesRes.status}`);
  }
  console.log('[TEST] ✓ Tables browsed successfully');

  // Step 3: Create order
  console.log('\n[TEST] Step 3: Create Order');
  const createOrderPayload = JSON.stringify({
    outletId: outletId,
    orderType: 'table',
  });

  console.log(`[TEST] Creating order with outlet ${outletId}...`);
  const createOrderRes = http.post(`${BASE_URL}/orders`, createOrderPayload, params);
  console.log(`[TEST] Create order response: HTTP ${createOrderRes.status}`);

  if (createOrderRes.status !== 200 && createOrderRes.status !== 201) {
    console.error(`[TEST] Order creation failed: ${createOrderRes.body}`);
    throw new Error(`Order creation failed: HTTP ${createOrderRes.status}`);
  }

  let orderId = null;
  let order = null;
  try {
    const body = JSON.parse(createOrderRes.body);
    orderId = body.id;
    order = body;
    console.log(`[TEST] ✓ Order created: ID ${orderId}, Bill# ${body.billNumber}`);
  } catch (e) {
    console.error(`[TEST] Failed to parse order response: ${e.message}`);
    throw new Error('Failed to parse order creation response');
  }

  if (!orderId) {
    throw new Error('Order ID is missing from response');
  }

  // Step 4: Add item to order
  console.log('\n[TEST] Step 4: Add Item to Order');

  const addItemPayload = JSON.stringify({
    foodId: selectedFood.id,
    quantity: 1,
  });

  console.log(`[TEST] Adding food ${selectedFood.id} (${selectedFood.name}) to order ${orderId}...`);
  const addItemRes = http.post(`${BASE_URL}/orders/${orderId}/items`, addItemPayload, params);
  console.log(`[TEST] Add item response: HTTP ${addItemRes.status}`);

  if (addItemRes.status !== 200 && addItemRes.status !== 201) {
    console.error(`[TEST] Add item failed: ${addItemRes.body}`);
    throw new Error(`Add item failed: HTTP ${addItemRes.status}`);
  }

  let orderItem = null;
  try {
    const body = JSON.parse(addItemRes.body);
    orderItem = body;
    console.log(`[TEST] ✓ Item added: ID ${body.id}, Food ${body.foodId}, Qty ${body.quantity}`);
  } catch (e) {
    console.error(`[TEST] Failed to parse item response: ${e.message}`);
    throw new Error('Failed to parse add-item response');
  }

  if (!orderItem.id) {
    throw new Error('Order item ID is missing from response');
  }

  // Step 5: Verify order was created
  console.log('\n[TEST] Step 5: Verify Order Details');
  const getOrderRes = http.get(`${BASE_URL}/orders/${orderId}`, params);
  console.log(`[TEST] Get order response: HTTP ${getOrderRes.status}`);

  if (getOrderRes.status !== 200) {
    console.error(`[TEST] Failed to fetch order: ${getOrderRes.body}`);
    throw new Error(`Get order failed: HTTP ${getOrderRes.status}`);
  }

  try {
    const body = JSON.parse(getOrderRes.body);
    console.log(`[TEST] ✓ Order verified: Status ${body.status}, Subtotal ${body.subtotal}`);
  } catch (e) {
    console.error(`[TEST] Failed to parse order details: ${e.message}`);
  }

  // Step 6: Get auth/me
  console.log('\n[TEST] Step 6: Get Current User Info (/auth/me)');
  const meRes = http.get(`${BASE_URL}/auth/me`, params);
  console.log(`[TEST] Auth/me response: HTTP ${meRes.status}`);

  if (meRes.status !== 200) {
    console.error(`[TEST] Failed to get current user: ${meRes.body}`);
    throw new Error(`Auth/me failed: HTTP ${meRes.status}`);
  }

  try {
    const body = JSON.parse(meRes.body);
    console.log(`[TEST] ✓ Current user: ${body.email} (ID: ${body.id})`);
  } catch (e) {
    console.error(`[TEST] Failed to parse auth/me response: ${e.message}`);
  }

  // Step 7: List assigned outlets
  console.log('\n[TEST] Step 7: List Assigned Outlets');
  const assignedOutletsRes = http.get(`${BASE_URL}/outlets/assigned`, params);
  console.log(`[TEST] Assigned outlets response: HTTP ${assignedOutletsRes.status}`);

  if (assignedOutletsRes.status !== 200) {
    console.error(`[TEST] Failed to fetch assigned outlets: ${assignedOutletsRes.body}`);
    throw new Error(`Assigned outlets failed: HTTP ${assignedOutletsRes.status}`);
  }

  try {
    const body = JSON.parse(assignedOutletsRes.body);
    const outletsList = Array.isArray(body) ? body : body.data || [];
    console.log(`[TEST] ✓ Waiter has access to ${outletsList.length} outlet(s)`);
  } catch (e) {
    console.error(`[TEST] Failed to parse outlets response: ${e.message}`);
  }

  console.log('\n[TEST] ========================================');
  console.log('[TEST] ✓ All diagnostic steps completed successfully!');
  console.log('[TEST] ========================================\n');
}

// ============================================================
// TEARDOWN - CLEANUP
// ============================================================

export function teardown(data) {
  const { adminToken, userId } = data;

  console.log('\n[TEARDOWN] ========================================');
  console.log('[TEARDOWN] Cleaning up test data...');
  console.log('[TEARDOWN] ========================================');

  if (userId && adminToken) {
    console.log('\n[TEARDOWN] Deactivating test waiter user...');
    const deactivateRes = http.patch(
      `${BASE_URL}/users/${userId}/deactivate`,
      null,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        timeout: __ENV.LOAD_TIMEOUT || '10000ms',
      }
    );

    console.log(`[TEARDOWN] Deactivate response: HTTP ${deactivateRes.status}`);

    if (deactivateRes.status === 204 || deactivateRes.status === 200) {
      console.log('[TEARDOWN] ✓ Test waiter deactivated');
    } else {
      console.error(`[TEARDOWN] Failed to deactivate user: ${deactivateRes.body}`);
    }
  }

  console.log('\n[TEARDOWN] ========================================');
  console.log('[TEARDOWN] Teardown complete');
  console.log('[TEARDOWN] ========================================\n');
}
