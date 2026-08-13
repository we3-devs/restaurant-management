import { check } from 'k6';
import { login, getProfile } from '../lib/auth.js';

// ============================================================
// SMOKE TEST: AUTH (1 VU, 1 iteration)
// ============================================================
// Tests login and profile retrieval. These must work before
// anything else can run.

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.00'],
    'http_req_failed{endpoint:login}': ['rate==0.00'],
    'http_req_failed{endpoint:profile}': ['rate==0.00'],
  },
};

export default function () {
  console.log('[AUTH_SMOKE] Starting auth smoke test...');

  // Step 1: Login
  console.log('[AUTH_SMOKE] Step 1: Login');
  let token;
  try {
    token = login();
    check(token, { 'login succeeded': (t) => t && t.length > 0 });
    console.log(`[AUTH_SMOKE] ✓ Login successful, token length: ${token.length}`);
  } catch (e) {
    check(false, { 'login succeeded': () => false });
    console.error(`[AUTH_SMOKE] ✗ Login failed: ${e.message}`);
    return;
  }

  // Step 2: Get profile
  console.log('[AUTH_SMOKE] Step 2: Get profile');
  try {
    const profile = getProfile(token);
    check(profile, {
      'profile retrieved': (p) => p && p.id,
      'profile has email': (p) => p && p.email,
    });
    console.log(`[AUTH_SMOKE] ✓ Profile retrieved: ${profile.email} (ID: ${profile.id})`);
  } catch (e) {
    check(false, { 'profile retrieved': () => false });
    console.error(`[AUTH_SMOKE] ✗ Profile fetch failed: ${e.message}`);
  }

  console.log('[AUTH_SMOKE] Auth smoke test complete');
}
