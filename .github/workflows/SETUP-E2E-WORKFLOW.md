# E2E Load Test Workflow Setup

This guide explains how to set up and run the complete end-to-end load test workflow that automatically creates test accounts and runs the realistic load test.

## Prerequisites

### 1. GitHub Secrets Setup

The workflow requires 2 GitHub secrets for admin authentication. These allow the workflow to:
- Log in as admin
- Create test accounts
- Assign roles
- Clean up after test (optional)

**To add secrets:**

1. Go to **GitHub** → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

Add these 2 secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `RMS_ADMIN_EMAIL` | Admin user email | `admin@rms.local` |
| `RMS_ADMIN_PASSWORD` | Admin password | `SecureAdmin123!` |

**These must correspond to an existing superadmin account in production.**

### 2. Verify Admin Account Exists

Before running the workflow, confirm your admin account works:

```bash
curl -X POST https://restaurant-management-g6vb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rms.local",
    "password": "your_admin_password"
  }'
```

Should return an `accessToken` and user data.

## How the Workflow Works

The E2E workflow has **7 phases**:

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Admin Authentication                                   │
│   └─ Log in as admin (uses RMS_ADMIN_EMAIL secret)             │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 2: Fetch Available Roles                                  │
│   └─ Get Manager, Cashier, Waiter, Cook role IDs               │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 3: Create Test Users & Assign Roles                       │
│   ├─ Create Manager account → Assign Manager role              │
│   ├─ Create Cashier account → Assign Cashier role              │
│   ├─ Create Waiter account → Assign Waiter role                │
│   └─ Create Cook account → Assign Cook role                    │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 4: Prepare Load Test                                      │
│   └─ Setup k6, verify test script exists                       │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 5: Run Realistic Load Test                                │
│   ├─ 50 concurrent users (gradual ramp 0→10→25→50)            │
│   ├─ 4 roles: Manager (25%), Cashier (25%), Waiter (25%), Cook│
│   ├─ 11 minutes total (ramp + sustain + ramp down)            │
│   ├─ 2-30 second think time between actions                   │
│   └─ Authenticated as Manager account                          │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 6: Extract & Display Results                              │
│   ├─ Error rate, p95/p99 latencies                             │
│   └─ Save results as artifact                                  │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 7: Cleanup (Optional)                                     │
│   └─ Deactivate all test accounts (if cleanup_after=true)     │
└─────────────────────────────────────────────────────────────────┘
```

## Running the Workflow

### Via GitHub UI (Easiest)

1. Go to **Actions** → **End-to-End Realistic Load Test (With Account Setup)**
2. Click **Run workflow** (top right)
3. Select cleanup option:
   - **`false`** — Keep test accounts (review them after)
   - **`true`** — Auto-delete test accounts
4. Click **Run workflow**

**Total time:** ~15 minutes

### What Happens

**Output in real-time:**
```
========================================
PHASE 1: Admin Authentication
========================================
✓ Admin authenticated successfully

========================================
PHASE 2: Fetching Available Roles
========================================
✓ Roles found: Manager(2), Cashier(3), Waiter(4), Cook(5)

========================================
PHASE 3A: Creating Manager Account
========================================
✓ Manager user created (ID: 42, Email: test-manager-1723123456@rms.local)
✓ Manager role assigned to user

========================================
PHASE 3B: Creating Cashier Account
========================================
✓ Cashier user created (ID: 43)
✓ Cashier role assigned

...

========================================
PHASE 5: Running Realistic Load Test
========================================

Configuration:
  Users:       50 VUs (gradual ramp)
  Duration:    11 minutes total
  Roles:       Manager, Cashier, Waiter, Cook (25% each)
  Think time:  2-30 seconds (realistic)

          /\      Grafana   /‾‾/
     /\  /  \     |\  __   /  /
    /  \/    \    | |/ /  /   ‾‾\
   /          \   |   (  |  (‾)  |
  / __________ \  |_|\_\  \_____/

running (0m00.1s), 00/50 VUs, 0 complete and 0 interrupted iterations
constant_load   [   0% ] 00/50 VUs  0s/11m  0.00 iters/s

... (test runs for ~11 minutes) ...

THRESHOLDS
  http_req_duration
  ✓ 'p(95) < 2000' p(95)=856.34ms
  ✓ 'p(99) < 4000' p(99)=1542.21ms

  http_req_failed
  ✓ 'rate < 0.01' rate=0.00%

TOTAL RESULTS
  checks_total: 12384
  checks_succeeded: 100.00% 12384 out of 12384
  checks_failed: 0.00% 0 out of 12384

✓ Load test completed

========================================
PHASE 6: Load Test Results
========================================
Key Metrics:
Error Rate: 0%
p95 Latency: 856ms
p99 Latency: 1542ms

========================================
✓ E2E Load Test Complete
========================================
```

## Analyzing Results

### Success Indicators ✓

```
Error rate:     < 1%
p95 latency:    < 2000ms
p99 latency:    < 4000ms
All checks:     100% passed
```

→ **API can handle ~50 concurrent restaurant staff ✓**

### Failure Indicators ✗

```
Error rate:     > 2%
p95 latency:    > 3000ms
Checks failed:  > 1%
```

→ **Investigate bottleneck** (see REALISTIC-TEST-GUIDE.md)

### How to Download Results

1. Go to workflow run (Actions → specific run number)
2. Scroll to **Artifacts**
3. Download `e2e-load-test-results-{run-id}` (JSON file)
4. Open in text editor or analyze with `jq`:

```bash
# Extract error rate
jq '.[] | select(.metric=="http_req_failed") | .data.value.rate' results.json

# Extract p95 latency
jq '.[] | select(.metric=="http_req_duration") | select(.data.value.p95)' results.json

# Extract all custom metrics (per-role)
jq '.[] | select(.metric | startswith("waiter_")) | "\(.metric): \(.data.value)"' results.json
jq '.[] | select(.metric | startswith("kitchen_")) | "\(.metric): \(.data.value)"' results.json
jq '.[] | select(.metric | startswith("cashier_")) | "\(.metric): \(.data.value)"' results.json
jq '.[] | select(.metric | startswith("manager_")) | "\(.metric): \(.data.value)"' results.json
```

## Test Account Details

The workflow **auto-generates unique test accounts** for each run:

- **Email format:** `test-{role}-{timestamp}@rms.local`
  - Example: `test-manager-1723123456@rms.local`
- **Password:** Always `TestLoad123!` (hardcoded for simplicity)
- **Roles:** Automatically assigned based on role ID

### Why Unique Emails?

Unique emails prevent conflicts when running multiple tests:
- You can run the test every day without account cleanup
- Each run creates fresh accounts
- Old accounts don't interfere

### Viewing Created Accounts

After the test, view accounts via:

**Option 1: GitHub workflow logs**
- Scroll to "Display Created Accounts" step
- See email, user ID, and password

**Option 2: API query**
```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Look for accounts with emails like `test-manager-*@rms.local`

## Cleanup Options

### Option A: Auto-Cleanup (Recommended)

When running workflow, select `cleanup_after = true`:
- Test accounts deactivated automatically
- No manual cleanup needed
- Clean database, no account accumulation

### Option B: Manual Cleanup

Select `cleanup_after = false` to keep accounts:
- Review test results first
- Verify accounts if needed
- Manually delete later

**To manually delete:**
```bash
curl -X PATCH https://restaurant-management-g6vb.onrender.com/api/users/{user_id}/deactivate \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

This revokes the account's role assignments (login still works but access is denied).

## Troubleshooting

### ❌ "Admin authentication failed"

**Cause:** Wrong credentials in GitHub secrets

**Fix:**
1. Verify `RMS_ADMIN_EMAIL` secret is correct
2. Verify `RMS_ADMIN_PASSWORD` secret is correct
3. Test manually:
   ```bash
   curl -X POST https://restaurant-management-g6vb.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
   ```
4. If credentials work manually but not in workflow, re-add secrets

### ❌ "Failed to fetch roles"

**Cause:** Admin account doesn't have `roles.view` permission

**Fix:**
- Ensure admin account has superadmin flag or roles.view permission
- Or: Create a dedicated load-test-admin account with `roles.view` + `users.manage` + `roles.manage`

### ❌ "Failed to create user"

**Cause:** Email already exists or invalid password

**Fix:**
- Workflow auto-generates unique emails, so this shouldn't happen
- Check if Supabase/database is down
- Check Render logs for errors

### ❌ "Load test completed but metrics show 0 requests"

**Cause:** Test accounts authenticated but had no permissions

**Fix:**
- Ensure role assignments actually succeeded
- Check if roles have required permissions
- Manually verify role assignment: `GET /users/{id}/role-assignments`

### ❌ Workflow times out (~20+ minutes)

**Cause:** API is slow or there's network latency

**Fix:**
- Check if Render/Supabase are down
- Check connection pool status
- Reduce VU ramp or test duration (edit the k6 script)

## Customization

### Change Test Duration

Edit `.github/workflows/realistic-load-test-e2e.yml`, find the k6 script section:

```yaml
- name: Run Realistic Load Test
  run: k6 run load-tests/rms-realistic.js ...
```

The stages in `rms-realistic.js` control duration:
- Default: 11 minutes total (5m ramp + 5m sustain + 1m ramp down)
- To change, edit `load-tests/rms-realistic.js` stages

### Change Max VUs

Edit `load-tests/rms-realistic.js`:

```javascript
stages: [
  { duration: '1m', target: 10 },   // ← Change 10 to higher
  { duration: '2m', target: 25 },   // ← Change 25 to higher
  { duration: '2m', target: 100 },  // ← Change 50 to 100 for stress test
  ...
]
```

### Change Test Accounts

Edit the workflow to create additional accounts, e.g., Bartender:

```yaml
- name: Create Bartender Account
  ...
  - curl ... POST /users
  - curl ... POST /users/{id}/role-assignments with bartender role ID
```

## Scheduling Regular Tests

To run this workflow on a schedule (e.g., daily):

Edit `.github/workflows/realistic-load-test-e2e.yml`, change the `on:` section:

```yaml
on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
    # Or: '0 */6 * * *'   # Every 6 hours
    # Or: '0 0 * * 1'     # Weekly on Monday
```

Now the test runs automatically!

**Note:** Make sure to enable `cleanup_after=true` for scheduled runs to avoid account accumulation.

## Performance Baseline

After first successful run, you have a baseline:

```
Test Run #1 (2026-08-13):
  Error rate:     0.2%
  p95 latency:    856ms
  p99 latency:    1542ms
  Verdict:        ✓ PASS
```

Use this to detect regressions:
- Next test: Compare to baseline
- If latency increases by 50%: Something changed (good/bad?)
- If error rate increases: Investigate

## Next Steps

1. ✅ Add `RMS_ADMIN_EMAIL` and `RMS_ADMIN_PASSWORD` secrets
2. ✅ Run workflow via GitHub Actions UI
3. ✅ Wait for ~15 minutes
4. ✅ Download artifact and review results
5. ✅ Compare to REALISTIC-TEST-GUIDE.md success criteria
6. ✅ If passes: Deploy with confidence
7. ✅ If fails: Investigate bottleneck and optimize

## See Also

- [REALISTIC-TEST-GUIDE.md](REALISTIC-TEST-GUIDE.md) — How to interpret results
- [CREATE-TEST-ACCOUNTS.md](CREATE-TEST-ACCOUNTS.md) — Manual account creation
- [REALISTIC-TEST-SUMMARY.md](REALISTIC-TEST-SUMMARY.md) — Overview of realistic test
