// ============================================================
// CENTRALIZED CONFIGURATION & ROUTES
// ============================================================
// All route paths and credentials in one place for easy maintenance.

export const config = {
  baseUrl: __ENV.API_URL || 'https://restaurant-management-g6vb.onrender.com/api',
  timeout: __ENV.LOAD_TIMEOUT || '10000ms',

  // Test credentials (from workflow or environment)
  email: __ENV.LOAD_TEST_EMAIL,
  password: __ENV.LOAD_TEST_PASSWORD,
  outletId: parseInt(__ENV.LOAD_TEST_OUTLET_ID || '1'),
  foodId: parseInt(__ENV.LOAD_TEST_FOOD_ID || '1'),
  tableId: parseInt(__ENV.LOAD_TEST_TABLE_ID || '1'),

  // All API routes (method: path)
  routes: {
    login: { method: 'POST', path: '/auth/login' },
    profile: { method: 'GET', path: '/auth/me' },

    listOrders: { method: 'GET', path: '/orders' },
    createOrder: { method: 'POST', path: '/orders' },
    getOrder: { method: 'GET', path: '/orders/:id' },
    addItem: { method: 'POST', path: '/orders/:id/items' },
    updateStatus: { method: 'PATCH', path: '/orders/:id/status' },

    listOutlets: { method: 'GET', path: '/outlets' },
    listAssignedOutlets: { method: 'GET', path: '/outlets/assigned' },

    listDiningTables: { method: 'GET', path: '/dining-tables' },
  },
};

// Validate required env vars
if (!config.email || !config.password) {
  throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables are required');
}
