# 🔄 Multi-User Load Test Guide

## Overview

The **Multi-User Load Test** is a more realistic variant that creates **50 unique user accounts** and distributes them across VUs. Each user authenticates independently and performs role-specific workflows.

This is fundamentally different from the single-user test:

| Aspect | Single-User | Multi-User |
|--------|-------------|-----------|
| Test Accounts | 1 (shared) | 50 (unique) |
| VU Behavior | All VUs use same token | Each VU has own user |
| Session Isolation | Single session | 50 independent sessions |
| Realism | ~70% | ~90% |
| Data Variance | Minimal | High |
| Use Case | Quick verification | Production simulation |

---

## What Gets Created

### User Distribution (50 Total)

```
┌─────────────────────────────────────┐
│ 50 Concurrent Users                 │
├─────────────────────────────────────┤
│ 25 Waiters      (50%)                │
│ 10 Cashiers     (20%)                │
│ 8 Cooks         (16%)                │
│ 7 Managers      (14%)                │
└─────────────────────────────────────┘

Each user:
  ✓ Unique email: test-{role}-{timestamp}-{id}@rms.local
  ✓ Unique password (same for all: TestLoad123!)
  ✓ Assigned role: Waiter/Cashier/Cook/Manager
  ✓ Independent authentication
  ✓ Independent session
  ✓ Role-specific workflows
```

### Account Creation Timeline

```
Setup Phase (BEFORE load test):
  [Admin Auth] → [Fetch Roles] → [Create 50 Accounts] → [Assign Roles]
  
  During this phase:
  ✓ 50 accounts created with unique emails
  ✓ 50 role assignments (25 to waiter, 10 to cashier, etc.)
  ✓ No load test traffic yet
  ✓ Takes ~2-3 minutes

Load Test Phase (11 minutes):
  ✓ k6 runs with 50 VUs
  ✓ Each VU authenticates as different user
  ✓ Each VU runs role-specific workflow
  ✓ Generates realistic multi-user load

Cleanup Phase (OPTIONAL):
  ✓ All 50 accounts deactivated
  ✓ No orphaned test accounts
  ✓ Clean database after test
```

---

## How It Works

### Phase 1: Setup (Admin Creates Accounts)

```javascript
// Workflow authenticates as admin
POST /auth/login
  email: admin@rms.local
  password: (from RMS_ADMIN_PASSWORD secret)
  → Returns admin token

// Workflow fetches available roles
GET /roles
  Authorization: Bearer admin_token
  → Returns: Manager(2), Cashier(3), Waiter(4), Cook(5)

// Workflow creates 50 users
for i in 1..50:
  POST /users
    name: "Test Waiter 1" (or Cashier/Cook/Manager)
    email: "test-waiter-{timestamp}-{i}@rms.local"
    password: "TestLoad123!"
    Authorization: Bearer admin_token
    → Returns: user_id = 42

  // Assign role to each user
  POST /users/{user_id}/role-assignments
    roleId: 4 (waiter for example)
    Authorization: Bearer admin_token
```

### Phase 2: Load Test (50 VUs, Each Unique User)

```javascript
export default function (data) {
  const { testUsers } = data;
  const vuId = __VU;  // 1, 2, 3, ..., 50

  // VU #1 gets testUsers[0]
  // VU #2 gets testUsers[1]
  // ... round-robin distribution
  const user = testUsers[vuId - 1];

  // Each VU authenticates AS THEIR USER
  const token = authenticateUser(user);
  // POST /auth/login
  //   email: test-waiter-{timestamp}-0@rms.local
  //   password: TestLoad123!
  // → token = unique JWT for this user

  // Workflow is role-specific
  if (user.role === 'waiter') {
    waiterWorkflow(token);  // Create orders, add items
  } else if (user.role === 'cook') {
    kitchenWorkflow(token); // Get tickets, mark ready
  }
  // ... etc
}
```

### Phase 3: Results & Cleanup

```
Results:
  ✓ 2,384+ requests from 50 unique users
  ✓ Per-role metrics (waiter errors, cook latency, etc.)
  ✓ Authentication success rate (did all 50 log in?)
  ✓ Per-user session data

Cleanup (if enabled):
  ✓ Deactivate all 50 accounts
  ✓ Loop through returned user IDs
  ✓ PATCH /users/{id}/deactivate for each
  ✓ Clean database after test
```

---

## Key Differences from Single-User Test

### Single-User Test
```
Setup:
  1. Admin authenticates ✓
  2. One token created ✓
  3. All VUs share this token

Load Test:
  VU #1  ──┐
  VU #2  ──┤
  VU #3  ──┼──→ [API] ← Same token for all
  VU #4  ──┤
  VU #5  ──┘
  
  Problem:
  - Single session (unrealistic)
  - All requests attributed to 1 user
  - No concurrent user sessions
  - Shared authentication state
```

### Multi-User Test
```
Setup:
  1. Admin authenticates
  2. 50 unique accounts created
  3. 50 tokens generated (one per user)

Load Test:
  VU #1 (Waiter 0)   ──┐
  VU #2 (Waiter 1)   ──┤
  VU #3 (Cashier 0)  ──┼──→ [API] ← Each has unique token
  VU #4 (Cook 0)     ──┤
  VU #5 (Manager 0)  ──┘
  
  Benefits:
  ✓ Independent sessions (realistic)
  ✓ Each request from different user
  ✓ Concurrent user simulation
  ✓ Better isolation testing
  ✓ Real session handling stress
```

---

## When to Use Multi-User vs Single-User

### Use Single-User Test When:
- ✓ Quick verification (< 5 min)
- ✓ Testing read-only endpoints
- ✓ Stress testing throughput (raw RPS)
- ✓ Simple load baseline
- ✓ Limited test time available

### Use Multi-User Test When:
- ✓ Production readiness assessment
- ✓ Realistic workload simulation
- ✓ Multi-user session handling
- ✓ User isolation testing
- ✓ Authentication/permission testing
- ✓ Detecting race conditions
- ✓ Full integration testing

**Recommendation:** Use multi-user test for production validation, single-user for quick iterations.

---

## Running the Multi-User Test

### Via GitHub Actions

1. Go to: **Actions** → **Multi-User Realistic Load Test**
2. Click: **Run workflow**
3. Choose: `cleanup_after` option (`true` recommended)
4. Click: **Run workflow**

**Total time:** ~15-20 minutes (account creation + test + cleanup)

### Locally (if needed)

```bash
k6 run load-tests/rms-realistic-multi-user.js \
  --vus 50 \
  --duration 11m
```

Environment variables:
```bash
LOAD_ADMIN_EMAIL=admin@rms.local
LOAD_ADMIN_PASSWORD=your_password
BASE_URL=https://restaurant-management-g6vb.onrender.com/api
LOAD_TIMEOUT=10000ms
```

---

## Expected Results

### Success Scenario ✅

```
Setup Phase:
  ✓ Admin authenticated
  ✓ Fetched 4 roles
  ✓ Created 50 test accounts (25 waiter, 10 cashier, 8 cook, 7 manager)
  ✓ Assigned 50 role assignments

Load Test (11 minutes):
  ✓ User authentication success: 100% (all 50 users logged in)
  ✓ Error rate: 0.2%
  ✓ p95 latency: 856ms
  ✓ p99 latency: 1542ms
  ✓ All per-role checks: < 2%
  
  Per-Role Sample:
    Waiter (25 users):   avg=200ms, errors=0.1%
    Cashier (10 users):  avg=280ms, errors=0.3%
    Cook (8 users):      avg=220ms, errors=0.2%
    Manager (7 users):   avg=350ms, errors=0.2%

Cleanup:
  ✓ Deactivated 50 accounts
  ✓ Database cleaned

Verdict: ✅ PRODUCTION READY
  API handles 50 concurrent unique users comfortably
```

### Investigation Scenario ⚠️

```
Load Test:
  User authentication success: 92% ✗ (4 users failed to login)
  Error rate: 2.5% ✗
  p95 latency: 2800ms ✗
  p99 latency: 5200ms ✗
  Waiter errors: 3.2% ✗ (highest)

Analysis:
  - 50 concurrent auth attempts might be hitting rate limit
  - OR: Authentication endpoint has capacity issue
  - OR: Session/token generation is slow
  - Waiter workflow (order creation) is slowest

Next Steps:
  1. Check if auth endpoint has rate limiting
  2. Review authentication service logs
  3. Check database connection pool during auth
  4. Consider connection pooling on auth service
  5. Re-test after optimization
```

---

## Metrics Explained

### User Authentication Metrics

| Metric | Meaning | Good | Bad |
|--------|---------|------|-----|
| `user_auth_errors` | % of failed authentications | < 1% | > 5% |
| `users_authenticated` | Count of successful logins | = 50 | < 45 |

If these fail:
- Check if auth endpoint can handle 50 concurrent logins
- Consider connection pooling
- Check auth service logs

### Per-Role Metrics (Same as Single-User)

| Metric | Meaning | Good | Bad |
|--------|---------|------|-----|
| `waiter_errors` | % waiter workflow failures | < 2% | > 5% |
| `kitchen_errors` | % kitchen workflow failures | < 2% | > 5% |
| `cashier_errors` | % cashier workflow failures | < 2% | > 5% |
| `manager_errors` | % manager workflow failures | < 2% | > 5% |

### Overall Metrics (Same as Single-User)

| Metric | Good | Acceptable | Bad |
|--------|------|-----------|-----|
| Error rate | < 1% | 1-2% | > 2% |
| p95 latency | < 1s | 1-2s | > 2s |
| p99 latency | < 2s | 2-4s | > 4s |

---

## Troubleshooting

### ❌ "User authentication failed" (Some users)

**Problem:** Not all 50 users can authenticate simultaneously

**Causes:**
- Auth endpoint rate limiting
- Auth service connection pool too small
- Authentication query too slow

**Fix:**
- Check auth service logs during test
- Increase connection pool size
- Add caching to auth response (if possible)
- Investigate authentication query performance

### ❌ "User authentication success: 92%"

**Problem:** Only ~46 out of 50 users authenticated

**Cause:** Likely timing issue or rate limiting

**Fix:**
- Increase timeout in k6 script
- Check if auth endpoint rejects fast requests
- Review auth service response times
- Run test again (might be intermittent)

### ❌ "Higher error rates in multi-user test than single-user"

**Problem:** More errors with 50 unique users than with 1

**Possible Causes:**
1. **User permissions:** Not all 50 users have same permissions
   - Fix: Verify roles were assigned correctly
   - Check: GET /users/{id}/role-assignments

2. **Session isolation issues:** Some endpoints don't work with different users
   - Fix: Check endpoint authorization
   - Verify: Each user can access their data

3. **Race conditions:** Multiple users accessing same data
   - Fix: Expected! Database should handle concurrency
   - Check: Database locks, deadlocks

4. **Authentication state:** Different users have different auth state
   - Fix: Compare single-user and multi-user token responses
   - Check: User role permissions

---

## Comparing Results

### Single-User vs Multi-User

Create a comparison table:

```
Metric                  Single-User    Multi-User    Difference
─────────────────────────────────────────────────────────────
Error rate              0.2%           0.3%          +0.1% (OK)
p95 latency             856ms          920ms         +64ms (OK)
p99 latency             1542ms         1680ms        +138ms (OK)
Concurrent sessions     1              50            +49 (real)
Auth success rate       100%           99.5%         -0.5% (OK)
```

**Interpretation:**
- Slightly higher latency with multi-user (expected, more concurrent load)
- Still well under thresholds
- 50 unique sessions working ✓
- Production ready ✓

---

## Advanced: Analyzing Per-User Data

The JSON results don't break down per-user, but you can estimate:

**If 50 users ran for 5 minutes at ~2 iterations each:**
```
50 users × 5 minutes × 2 iterations/min = 500 total iterations
500 iterations × 4 workflows/iteration = 2,000 requests

Per user average:
  2,000 requests / 50 users = 40 requests per user
  40 requests / 5 minutes = 8 requests/minute per user
```

**Latency distribution:**
If p95 = 920ms and p99 = 1680ms, most users experienced:
- 95% of requests: < 920ms (good!)
- 99% of requests: < 1680ms (acceptable!)

This means ~49 users had reasonable response times, suggesting load is evenly distributed.

---

## Next Steps

### After Test Passes ✓

1. **Document baseline:**
   - Save results JSON
   - Note: "50-user test: 0.3% error, p95=920ms"

2. **Schedule regular tests:**
   - Weekly multi-user tests
   - After deployments
   - Before major features

3. **Optimize if needed:**
   - Add caching for frequently accessed data
   - Connection pool tuning
   - Query optimization

### If Test Fails ✗

1. **Identify bottleneck:**
   - Which role has highest errors?
   - Which endpoint is slowest?

2. **Investigate:**
   - Check database query performance
   - Review auth service logs
   - Check connection pool status
   - Look for N+1 queries

3. **Fix and re-test:**
   - Make optimization
   - Re-run multi-user test
   - Compare results

---

## Example Workflow

**Day 1: Baseline**
```
Run multi-user test → Results: 0.2% error, p95=850ms
→ Save as baseline
→ Document deployment state
```

**Day 2: After new feature**
```
Run multi-user test → Results: 0.3% error, p95=920ms
→ Compare to baseline
→ Increase: +0.1% error, +70ms latency
→ Investigation: New query added? Inefficient? Needs indexing?
→ Decide: Deploy or optimize first?
```

**Day 7: After optimization**
```
Run multi-user test → Results: 0.2% error, p95=800ms
→ Compare to Day 2: -0.1% error, -120ms latency
→ Optimization worked! Deploy
```

---

## FAQ

**Q: Why 50 users specifically?**
A: Represents typical full shift (2-3 per role × 15-20 staff). Stress realistic scenarios without killing the API.

**Q: Can I change user distribution?**
A: Yes! Edit `rms-realistic-multi-user.js` line ~199:
```javascript
const userDistribution = [
  ...Array(30).fill('waiter'),   // ← Change 25 to 30
  ...Array(10).fill('cashier'),
  ...Array(10).fill('cook'),
];
```

**Q: How long does setup take?**
A: ~2-3 minutes to create and assign 50 accounts.

**Q: Can I test 100 users?**
A: Yes! Edit stages in options, or duplicate load balancing logic.

**Q: Does each VU really get unique user?**
A: Yes! Line 481: `const userIndex = (vuId - 1) % testUsers.length;` distributes uniquely.

**Q: Are test accounts cleaned up?**
A: Only if `cleanup_after=true`. Otherwise kept for inspection.

---

## See Also

- [REALISTIC-TEST-GUIDE.md](REALISTIC-TEST-GUIDE.md) - Single-user test guide
- [SETUP-E2E-WORKFLOW.md](../.github/workflows/SETUP-E2E-WORKFLOW.md) - Workflow documentation
- [CREATE-TEST-ACCOUNTS.md](CREATE-TEST-ACCOUNTS.md) - Manual account creation

---

**Ready to test with 50 unique users?** Go to Actions and run the workflow! 🚀
