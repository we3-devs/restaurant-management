# Modular Load Tests — User Guide

## Overview

The old 11-minute monolithic test hid failures in cascading checks. This modular suite replaces it with small, debuggable tests:

- **Smoke tests** (must pass first): Auth, then full order lifecycle with per-step logging
- **Flow tests** (one per role): Waiter, Kitchen, Cashier, Manager
- **GitHub Actions matrix**: Shows which test failed in the UI without running everything

## Key Improvements

✓ **Per-step logging in order-lifecycle smoke test** — if status update fails with 403, you see that status code instantly  
✓ **Endpoint-scoped thresholds** — a slow outlet read won't fail the order-create test  
✓ **Role assignment now fails loudly** — no more silent ⚠️ masking permission issues  
✓ **Each test is standalone** — run `k6 run load-tests/flows/waiter.js` in isolation  
✓ **Matrix UI** — GitHub Actions shows exactly which test broke

## Running Tests Locally

### Prerequisites

```bash
k6 --version  # Must have k6 installed (v0.47+)
```

### Smoke Tests (run these first!)

These must pass before flow tests make sense.

```bash
# Test 1: Auth + Profile
export API_URL="https://restaurant-management-g6vb.onrender.com/api"
export LOAD_TEST_EMAIL="your-manager-email@rms.local"
export LOAD_TEST_PASSWORD="TestLoad123!"
export LOAD_TEST_OUTLET_ID="1"
export LOAD_TEST_FOOD_ID="1"

k6 run load-tests/smoke/auth.js

# Test 2: Full Order Lifecycle (the critical one)
#         Creates order → adds item → sets status → marks complete
#         Logs the status code of EVERY step
k6 run load-tests/smoke/order-lifecycle.js
```

Expected output for `order-lifecycle.js` if order writes are working:

```
[ORDER_LIFECYCLE] ✓ Order created (ID: 12345)
[ORDER_LIFECYCLE] ✓ Item added (HTTP 201)
[ORDER_LIFECYCLE] ✓ Status set to preparing (HTTP 200)
[ORDER_LIFECYCLE] ✓ Order completed (HTTP 200)
```

If you see:

```
[ORDER_LIFECYCLE] ✗ Add item failed (HTTP 403) - will continue
[ORDER_LIFECYCLE] ✗ Set status failed (HTTP 403) - will continue
[ORDER_LIFECYCLE] ✗ Complete order failed (HTTP 403)
```

→ The user is missing `orders.manage` permission. Check the GitHub Actions workflow's role assignment step.

### Flow Tests (after smoke passes)

```bash
# Each test runs 5 VUs for 1 minute
# Test from a specific role perspective

k6 run load-tests/flows/waiter.js      # Create order, add items
k6 run load-tests/flows/kitchen.js     # Set status to preparing
k6 run load-tests/flows/cashier.js     # Mark order complete
k6 run load-tests/flows/manager.js     # List orders, outlets (read-only)
```

## Running via GitHub Actions

1. Go to **Actions** → **Modular Load Tests (Smoke + Flows)**
2. Click **Run workflow** → **Run workflow**
3. Optionally check "Delete test accounts after test completes" if you want cleanup

The workflow will:

1. **Setup** (5 min): Create manager account, assign roles, create test food
   - If role assignment fails → workflow stops immediately
   - Outputs outlet and food IDs for tests

2. **Smoke tests** (sequential, fail-fast):
   - If either fails → flow tests are skipped
   - If both pass → flow tests run in parallel

3. **Flow tests** (parallel):
   - Each test gets a matrix entry in the Actions UI
   - Waiter, Kitchen, Cashier, Manager run in parallel
   - One flow failing doesn't block others

4. **Cleanup** (if enabled): Deactivates the test manager account

5. **Summary**: Reports pass/fail status

## Interpreting Results

### Smoke Test Failures

| Output | Cause | Fix |
|--------|-------|-----|
| `Login failed: HTTP 401` | Bad email/password in workflow secrets | Check `RMS_ADMIN_EMAIL` and `RMS_ADMIN_PASSWORD` |
| `Profile fetch failed: HTTP 401` | Bad token or user deactivated | Run auth smoke test locally with the same creds |
| `Create order failed: HTTP 403` | Manager missing `orders.manage` permission | Check role assignment step in workflow |
| `Add item failed: HTTP 400` | Bad food ID or order state invalid | Check food exists: `GET /foods/{id}` |
| `Set status failed: HTTP 400` | Invalid status transition for order | Check valid transitions in orders.entity.ts |

### Flow Test Failures

Flow tests only measure specific endpoints (see threshold comments in code):

- **waiter.js**: Only thresholds on `create_order` and `add_item`
- **kitchen.js**: Only thresholds on `set_status` (order setup is excluded)
- **cashier.js**: Only thresholds on order completion
- **manager.js**: Only thresholds on read endpoints (list orders, outlets)

If `http_req_failed{endpoint:add_item}` exceeds threshold → food might not exist in that outlet, or permission missing.

## Common Issues

### "Manager role assignment failed or returned empty"

The role assignment endpoint returned `{}` or `null` instead of `{id: ...}`.

**Check:**
1. Does the manager role exist? `GET /roles`
2. Does the user exist? `GET /users/:id`
3. Is the user already assigned to this role?

**To debug locally:**

```bash
# Get admin token
ADMIN_TOKEN=$(curl -s -X POST "https://restaurant-management-g6vb.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@...", "password":"..."}' | jq -r '.accessToken')

# Get manager role ID
curl -s https://restaurant-management-g6vb.onrender.com/api/roles \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | select(.slug=="manager")'

# Try assigning (replace IDs)
curl -s -X POST "https://restaurant-management-g6vb.onrender.com/api/users/123/role-assignments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleId": 456}' | jq '.'
```

### "Add item failed: HTTP 422"

Food doesn't exist or isn't valid for that outlet.

**Check:**
```bash
# Get food details
curl -s https://restaurant-management-g6vb.onrender.com/api/foods/1 \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Check if food is available at the outlet
curl -s https://restaurant-management-g6vb.onrender.com/api/foods/1/outlets \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### "Set status failed: HTTP 409"

Invalid status transition (e.g., can't go from `completed` to `preparing`).

Order statuses are directional: `pending` → `accepted` → `preparing` → `ready` → `served` → `completed`.

## File Structure

```
load-tests/
├── lib/                 # Shared libraries
│   ├── config.js       # Routes + env vars (single source of truth)
│   ├── http.js         # HTTP wrapper with error logging
│   ├── auth.js         # Login + profile
│   └── orders.js       # Order lifecycle operations
├── smoke/              # Must pass before flow tests
│   ├── auth.js         # Login + profile
│   └── order-lifecycle.js  # Full lifecycle with per-step logging
├── flows/              # One per role/scenario
│   ├── waiter.js
│   ├── kitchen.js
│   ├── cashier.js
│   └── manager.js
└── rms-realistic.js    # (keep for actual capacity testing later)
```

## Configuration

All routes and credentials come from:

1. **Environment variables** (set by workflow or command line):
   - `API_URL` — API base URL
   - `LOAD_TEST_EMAIL` — Manager account email
   - `LOAD_TEST_PASSWORD` — Manager account password
   - `LOAD_TEST_OUTLET_ID` — Outlet ID for order creation
   - `LOAD_TEST_FOOD_ID` — Food ID for order items
   - `LOAD_TEST_TIMEOUT` — HTTP timeout (default 10s)

2. **Centralized route paths** in `lib/config.js`:
   - If an endpoint URL is wrong, fix it in one place
   - All tests inherit the fix automatically

## Next Steps

After smoke + flow tests pass consistently:

1. **Rename test accounts** to match expected roles (currently all test with manager account)
2. **Run actual capacity tests** with the old `rms-realistic.js` (50 VUs, 11 min)
3. **Monitor Render logs** for slow queries or connection pool exhaustion
4. **Tune thresholds** based on actual acceptable latencies

## Troubleshooting

**Test hangs?**
- Check `LOAD_TIMEOUT` env var (default 10s)
- Run locally and look for console output
- Is the API responding at all? `curl -s https://restaurant-management-g6vb.onrender.com/api/auth/login`

**All tests fail with 401 (Unauthorized)?**
- Admin credentials in workflow secrets are stale or wrong
- Test locally: `curl -s -X POST https://... -d '{"email":"...", "password":"..."}' | jq '.'`

**Role assignment succeeds in workflow but flow tests fail with 403?**
- The role is assigned to the user, but the role doesn't have `orders.manage` permission
- Check the role definition in the database: does it have the right permissions?

**Food creation fails?**
- Is the slug unique? (k6 runs might create dupes)
- Check: `curl -s https://restaurant-management-g6vb.onrender.com/api/foods?search=test | jq '.data | length'`

---

**Questions?** Check the step-by-step logs in the GitHub Actions workflow for which exact HTTP status/body is returned.
