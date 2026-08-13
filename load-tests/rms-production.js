import http from 'k6/http';
import { check, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ============================================================
// CONFIGURATION (FROM ENVIRONMENT)
// ============================================================

const BASE_URL = __ENV.BASE_URL || 'https://restaurant-management-g6vb.onrender.com/api';
const LOAD_RPS = parseInt(__ENV.LOAD_RPS || '25', 10);
const LOAD_DURATION = __ENV.LOAD_DURATION || '30s';
const LOAD_VUS = parseInt(__ENV.LOAD_VUS || '10', 10);
const LOAD_TIMEOUT = __ENV.LOAD_TIMEOUT || '10000ms';
const TEST_EMAIL = __ENV.LOAD_TEST_EMAIL;
const TEST_PASSWORD = __ENV.LOAD_TEST_PASSWORD;

// Validate required credentials
if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables are required');
}

// ============================================================
// CUSTOM METRICS - ENDPOINT TRACKING
// ============================================================

const authMeDuration = new Trend('endpoint_auth_me_duration');
const diningTablesDuration = new Trend('endpoint_dining_tables_duration');
const outletsAssignedDuration = new Trend('endpoint_outlets_assigned_duration');
const wsTicketDuration = new Trend('endpoint_ws_ticket_duration');

const authMeErrors = new Rate('endpoint_auth_me_errors');
const diningTablesErrors = new Rate('endpoint_dining_tables_errors');
const outletsAssignedErrors = new Rate('endpoint_outlets_assigned_errors');
const wsTicketErrors = new Rate('endpoint_ws_ticket_errors');

// ============================================================
// TEST EXECUTOR - CONSTANT-ARRIVAL-RATE (RPS CONTROL)
// ============================================================

export const options = {
  // Use constant-arrival-rate executor for precise RPS control
  // https://k6.io/docs/using-k6/scenarios/executors/constant-arrival-rate/
  scenarios: {
    constant_load: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: LOAD_VUS,
      maxVUs: LOAD_VUS * 2, // Allow bursting if needed
      stages: [
        { duration: '10s', target: LOAD_RPS }, // Ramp up over 10s
        { duration: LOAD_DURATION, target: LOAD_RPS }, // Hold for test duration
        { duration: '5s', target: 0 }, // Ramp down over 5s
      ],
    },
  },

  // Thresholds - fail the test if these are exceeded
  thresholds: {
    'http_req_failed': ['rate < 0.01'], // < 1% error rate
    'http_req_duration': ['p(95) < 1000', 'p(99) < 2000'], // p95 < 1s, p99 < 2s
  },
};

// ============================================================
// SETUP - AUTHENTICATE ONCE
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
      'User-Agent': 'k6-load-test',
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
  console.log('[SETUP] Test configuration:');
  console.log(`[SETUP]   Base URL: ${BASE_URL}`);
  console.log(`[SETUP]   Target RPS: ${LOAD_RPS}`);
  console.log(`[SETUP]   Duration: ${LOAD_DURATION}`);
  console.log(`[SETUP]   Max VUs: ${LOAD_VUS}`);
  console.log(`[SETUP]   Request timeout: ${LOAD_TIMEOUT}`);
  console.log('[SETUP]   Endpoints: 40% /auth/me, 20% /ws-ticket, 20% /dining-tables, 20% /outlets');

  return { accessToken };
}

// ============================================================
// LOAD TEST LOGIC
// ============================================================

export default function (data) {
  const { accessToken } = data;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const httpParams = {
    headers: authHeaders,
    timeout: LOAD_TIMEOUT,
  };

  // Weighted endpoint distribution
  const rand = Math.random() * 100;

  if (rand < 40) {
    // GET /auth/me (40%)
    group('GET /auth/me', () => {
      const res = http.get(`${BASE_URL}/auth/me`, httpParams);
      authMeDuration.add(res.timings.duration);
      authMeErrors.add(res.status >= 400 ? 1 : 0);
      check(res, { 'auth/me 2xx': (r) => r.status < 400 });
    });
  } else if (rand < 60) {
    // POST /auth/ws-ticket (20%)
    group('POST /auth/ws-ticket', () => {
      const res = http.post(`${BASE_URL}/auth/ws-ticket`, '{}', httpParams);
      wsTicketDuration.add(res.timings.duration);
      wsTicketErrors.add(res.status >= 400 ? 1 : 0);
      check(res, { 'ws-ticket 2xx': (r) => r.status < 400 });
    });
  } else if (rand < 80) {
    // GET /dining-tables (20%)
    group('GET /dining-tables', () => {
      const res = http.get(`${BASE_URL}/dining-tables`, httpParams);
      diningTablesDuration.add(res.timings.duration);
      diningTablesErrors.add(res.status >= 400 ? 1 : 0);
      check(res, { 'dining-tables 2xx': (r) => r.status < 400 });
    });
  } else {
    // GET /outlets/assigned (20%)
    group('GET /outlets/assigned', () => {
      const res = http.get(`${BASE_URL}/outlets/assigned`, httpParams);
      outletsAssignedDuration.add(res.timings.duration);
      outletsAssignedErrors.add(res.status >= 400 ? 1 : 0);
      check(res, { 'outlets 2xx': (r) => r.status < 400 });
    });
  }
}

// ============================================================
// TEARDOWN
// ============================================================

export function teardown() {
  console.log('[TEARDOWN] Load test completed');
}
