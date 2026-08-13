import { check, sleep } from 'k6';
import { config } from '../lib/config.js';
import { request } from '../lib/http.js';
import { login } from '../lib/auth.js';
import { listOrders } from '../lib/orders.js';

// ============================================================
// FLOW TEST: MANAGER (≤5 VUs, ≤1 minute)
// ============================================================
// Manager workflow: read-only operations (list orders, outlets, profile)
// Must actually exercise endpoints - not  "0 out of 0" vacuous pass

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    'http_req_failed{endpoint:list_orders}': ['rate<0.05'],
    'http_req_failed{endpoint:list_outlets}': ['rate<0.05'],
    'http_req_duration{endpoint:list_orders}': ['p(95)<2000'],
    'http_req_duration{endpoint:list_outlets}': ['p(95)<2000'],
  },
};

export default function () {
  const token = login();

  // List orders
  const ordersRes = listOrders(token);
  check(ordersRes, {
    'orders listed': (r) => r && r.status === 200,
  });

  sleep(1);

  // List outlets
  const outletRoute = config.routes.listOutlets;
  const outletsRes = request(
    outletRoute.method,
    outletRoute.path,
    null,
    { Authorization: `Bearer ${token}` },
    'list_outlets'
  );
  check(outletsRes, {
    'outlets listed': (r) => r && r.status === 200,
  });

  sleep(1);

  // Get profile (already tested in smoke, but include for full flow)
  const profileRoute = config.routes.profile;
  const profileRes = request(
    profileRoute.method,
    profileRoute.path,
    null,
    { Authorization: `Bearer ${token}` },
    'profile'
  );
  check(profileRes, {
    'profile retrieved': (r) => r && r.status === 200,
  });
}
