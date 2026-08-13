# 🔍 Run the Diagnostic 1-VU Test

## TL;DR

The 50-VU test is failing with 75% error rate. Before running more load tests, **run this 1-VU diagnostic** to identify the root cause.

### What's Different
- ✓ Uses **real table IDs and food IDs** (fetched from backend)
- ✓ Runs with only **1 user** (not 50) → isolates from load issues
- ✓ Captures **all HTTP status codes and response bodies**
- ✓ Tests complete workflow: order → items → kitchen → payment
- ✓ Takes **~2 minutes** (not 11 minutes)

### Expected Outcome
If this test passes:
- ✓ Backend API is working correctly
- ✓ Test accounts can authenticate
- ✓ Workflows complete end-to-end
- ✗ If 50-VU still fails → concurrency issue (DB pool, race conditions)

If this test fails:
- ✓ Identifies exact step and HTTP status
- ✓ Points to RBAC, data, or payload issues
- ✓ Guides fix before running 50-VU

---

## How to Run

### Option 1: GitHub Actions (Recommended) 🚀

1. Go to your repository
2. Click **Actions** tab
3. Click **"Diagnostic 1-VU Test"** workflow (on the left)
4. Click **"Run workflow"** button
5. Click **"Run workflow"** again in the dropdown
6. Wait ~2 minutes for job to complete
7. **Check the job logs** for detailed output (click the job name → scroll down for test output)

**The logs will show:**
```
[TEST] Step 3: Create Order
[TEST] Creating order with payload: {...}
[TEST] Create order response: HTTP 201
[TEST] Create order response body: {"id":"order-123",...}
[TEST] ✓ Order created: order-123
```

### Option 2: Local (requires k6)

```bash
# Install k6 if not already installed
# macOS: brew install k6
# Linux: sudo apt-get install -y software-properties-common && sudo add-apt-repository ppa:grafana/k6 && sudo apt-get update && sudo apt-get install k6
# Windows: choco install k6

# Run the diagnostic test
k6 run load-tests/rms-diagnostic-1vu.js \
  --env BASE_URL="https://restaurant-management-g6vb.onrender.com/api" \
  --env LOAD_ADMIN_EMAIL="your-admin-email@example.com" \
  --env LOAD_ADMIN_PASSWORD="your-password" \
  --env LOAD_TIMEOUT="10000ms"
```

---

## Reading the Results

### ✓ Success Pattern
```
[SETUP] ✓ Admin authenticated
[SETUP] ✓ Found 8 tables
[SETUP] ✓ Found 42 foods
[SETUP] ✓ Created user: user-id-xxx

[TEST] Step 3: Create Order
[TEST] Create order response: HTTP 201
[TEST] ✓ Order created: order-123

[TEST] Step 4: Add Items to Order
[TEST] Add items response: HTTP 201
```
→ All green = workflow is working correctly

### ✗ Failure Pattern
```
[TEST] Step 3: Create Order
[TEST] Create order response: HTTP 403
[TEST] Create order response body: {"statusCode":403,"message":"Forbidden: Missing permission 'order:create'"}
[TEST] ✗ Order creation failed with HTTP 403
```
→ Identifies exact problem (RBAC permission missing)

---

## HTTP Status Codes Explained

| Status | Meaning | Likely Cause |
|--------|---------|--------------|
| **200/201** | ✓ Success | Test passed |
| **400** | ✗ Bad Request | Invalid payload or table/food ID format |
| **403** | ✗ Forbidden | Role lacks required permission |
| **404** | ✗ Not Found | Table/order/food doesn't exist or endpoint wrong |
| **409** | ✗ Conflict | Resource in wrong state (e.g., table unavailable) |
| **500** | ✗ Server Error | Backend exception or database error |

---

## What Each Step Tests

1. **Admin Auth** → Can backend be reached?
2. **Fetch Tables** → Do dining tables exist?
3. **Fetch Foods** → Do menu items exist?
4. **Create User** → Can waiter accounts be created?
5. **Waiter Auth** → Can waiter login?
6. **Browse Tables** → Can waiter see tables? (RBAC check)
7. **Create Order** → 🔥 **CRITICAL STEP** — uses real table
8. **Add Items** → Can order items be added?
9. **Auth/Me** → Can waiter access protected endpoints?

---

## Common Failures & Fixes

### ❌ Step 7 (Create Order) Fails with HTTP 403
**Problem:** Waiter role lacks `order:create` permission

**Fix:**
```bash
# Check backend logs or database:
# - Verify waiter role has 'order:create' permission
# - Verify permission is assigned to the role
```

### ❌ Step 7 (Create Order) Fails with HTTP 400
**Problem:** Invalid table ID format

**Fix:**
- The test fetches real table IDs from the API
- If this fails, either:
  - Backend returns no tables → No dining tables seeded
  - Backend returns wrong format → API contract mismatch

### ❌ Step 2 (Fetch Tables) Returns Empty Array
**Problem:** No dining tables exist

**Fix:**
```bash
# Manually check tables:
curl -X GET "https://restaurant-management-g6vb.onrender.com/api/dining-tables" \
  -H "Authorization: Bearer <admin-token>"
# Should return array with at least 1 table object
```

### ❌ Step 1 (Admin Auth) Fails
**Problem:** Backend unreachable or credentials wrong

**Fix:**
- Verify API URL is correct
- Verify admin credentials in GitHub secrets
- Check if backend is running/deployed

---

## Decision Tree: What to Do Next

```
Diagnostic test result?
│
├─ ✓ PASSED
│  └─ Run the 50-VU test again
│     ├─ If 50-VU passes → 🎉 Done!
│     └─ If 50-VU fails → Concurrency issue
│        → Check DB pool size, connection reuse, rate limits
│
├─ ✗ FAILED at Step 3 (Create Order)
│  └─ RBAC or data issue
│     ├─ If HTTP 403 → Grant order:create permission to waiter role
│     ├─ If HTTP 400 → Fix table ID format
│     ├─ If HTTP 404 → Seed dining tables
│     └─ Fix issue, re-run diagnostic
│
├─ ✗ FAILED at Step 1-2 (Admin/Data)
│  └─ Backend/data issue
│     ├─ If backend unreachable → Check deployment
│     ├─ If no tables/foods → Seed test data
│     └─ Fix issue, re-run diagnostic
│
└─ ✗ FAILED at Step 4-9 (Waiter workflow)
   └─ Similar to Step 3
      → Check permissions, data, payload format
```

---

## Detailed Diagnostic Guide

For step-by-step troubleshooting, see:
📖 **[load-tests/DIAGNOSTIC-GUIDE.md](load-tests/DIAGNOSTIC-GUIDE.md)**

This includes:
- What each step tests
- HTTP status code explanations
- Common failure scenarios with solutions
- Flowchart for diagnosis

---

## Questions?

When asking for help, share:
1. ✓ Full output from the diagnostic test
2. ✓ Which step failed (Step 1-9)
3. ✓ HTTP status code
4. ✓ Response body from the failed step
5. ✓ Timestamp of test run

---

**Quick Links:**
- [Diagnostic Guide](load-tests/DIAGNOSTIC-GUIDE.md) — Detailed troubleshooting
- [GitHub Actions Workflow](.github/workflows/diagnostic-1vu-test.yml) — View the test code
- [k6 Test Script](load-tests/rms-diagnostic-1vu.js) — View what's being tested
