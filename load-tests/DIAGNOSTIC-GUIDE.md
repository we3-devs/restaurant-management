# Diagnostic 1-VU Test Guide

## Purpose

The diagnostic 1-VU test is designed to **isolate and identify the root cause** of workflow failures by:

1. Running with **only 1 virtual user** (not 50) → eliminates concurrency/load issues
2. Using **real table IDs and food IDs** from the backend → eliminates data mismatch issues
3. **Capturing all HTTP status codes and response bodies** → enables precise root cause diagnosis
4. **Testing the complete order workflow** → order creation → add items → status updates

## When to Run This Test

Run this test BEFORE running the 50-VU test when:
- ✗ Order creation is failing (0 orders created)
- ✗ Item addition is failing
- ✗ Kitchen/payment workflows are failing
- ✗ Unknown HTTP status codes in logs
- ✓ You want to verify that 1 user can complete the full workflow

## What This Test Does

### Step 1: Admin Authentication
```
Admin logs in → retrieves accessToken
```
- ✓ Expected: HTTP 200/201
- ✗ If fails: Backend unreachable or credentials wrong

### Step 2: Fetch Real Data
```
Admin fetches:
  - Roles (waiter, cashier, cook, manager)
  - Outlets (physical restaurant locations)
  - Dining Tables (actual table IDs available)
  - Foods (actual menu items with prices)
```
- ✓ Expected: HTTP 200, returns arrays of real objects
- ✗ If fails: Test data not seeded or missing database records

### Step 3: Create Test Waiter Account
```
Admin creates a new waiter user with:
  - Unique email: test-waiter-diag-{timestamp}@rms.local
  - Password: TestLoad123!
  - Role: Waiter
```
- ✓ Expected: HTTP 200/201, returns userId
- ✗ If HTTP 400: Email already exists or validation fails
- ✗ If HTTP 403: Admin lacks permission to create users

### Step 4: Waiter Login
```
New waiter logs in with their credentials
```
- ✓ Expected: HTTP 200/201, returns accessToken
- ✗ If fails: Account not activated or password wrong

### Step 5: Browse Dining Tables (as Waiter)
```
Waiter lists available tables at their outlet
```
- ✓ Expected: HTTP 200, returns array of table objects
- ✗ If HTTP 403: Waiter role lacks permission to view tables
- ✗ If HTTP 404: Endpoint not found
- ✗ If empty array: No tables assigned to outlet

### Step 6: Create Order (with Real Table)
```
Waiter creates order for a real table using:
  - tableId: from step 5 (real table ID)
  - customerName: generated unique name
```
- ✓ Expected: HTTP 200/201, returns orderId
- **This is the CRITICAL step — if this fails, entire workflow fails**
- ✗ If HTTP 400: Invalid payload (check `tableId` format)
- ✗ If HTTP 403: Waiter lacks permission to create orders
- ✗ If HTTP 404: Table ID doesn't exist
- ✗ If HTTP 409: Table already has an active order

### Step 7: Add Items to Order (with Real Food)
```
Waiter adds food items to the order using:
  - orderId: from step 6
  - foodId: real food ID from step 2
  - quantity & price: from menu data
```
- ✓ Expected: HTTP 200/201
- ✗ If HTTP 400: Invalid foodId or quantity format
- ✗ If HTTP 404: Order or food doesn't exist
- ✗ If HTTP 409: Order in wrong status for adding items

### Step 8: Get Current User (auth/me)
```
Waiter checks their own profile
```
- ✓ Expected: HTTP 200, returns user object with role & permissions
- ✗ If HTTP 401: Token invalid or expired

### Step 9: List Outlets
```
Waiter lists outlets they're assigned to
```
- ✓ Expected: HTTP 200, returns array of outlets
- ✗ If HTTP 403: Permission denied
- ✗ If empty array: User not assigned to any outlet

## Reading the Test Output

The test prints detailed logs for each step. Look for:

### Success Pattern
```
[TEST] Step 3: Create Order
[TEST] Creating order with payload: {...}
[TEST] Create order response: HTTP 201
[TEST] Create order response body: {"id":"order-123","status":"pending",...}
[TEST] ✓ Order created: order-123

[TEST] Step 4: Add Items to Order
[TEST] Adding items with payload: {...}
[TEST] Add items response: HTTP 201
[TEST] Add items response body: {"success":true,"itemsAdded":1}
```

### Failure Pattern
```
[TEST] Step 3: Create Order
[TEST] Creating order with payload: {...}
[TEST] Create order response: HTTP 403
[TEST] Create order response body: {"statusCode":403,"message":"Forbidden: Missing permission 'order:create'"}
[TEST] ✗ Order creation failed with HTTP 403
```

## Interpreting HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| **200/201** | Success | ✓ Test passed for this step |
| **400** | Bad Request | Check payload structure, data types, required fields |
| **401** | Unauthorized | Token expired or invalid; re-authenticate |
| **403** | Forbidden | User lacks required permission; check RBAC config |
| **404** | Not Found | Resource/endpoint doesn't exist; check IDs |
| **409** | Conflict | Resource in wrong state or already exists |
| **500** | Server Error | Backend bug or exception; check server logs |
| **503** | Service Unavailable | Backend/DB temporarily down |

## Common Failure Scenarios & Solutions

### Scenario 1: Order Creation Fails (HTTP 400)
**Issue**: Invalid `tableId` in payload

**Debug Steps**:
1. Check what tableId was fetched in Step 2
2. Log shows: `"tableId":"table-1"` but real tables are UUIDs like `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`
3. Fix: Use actual table IDs from the API response

**Solution**:
- Seed test data with proper table records
- OR verify dining-tables endpoint returns valid IDs

---

### Scenario 2: Order Creation Fails (HTTP 403)
**Issue**: Waiter lacks permission

**Debug Steps**:
1. Check if waiter was successfully assigned the role in Step 3
2. Get auth/me response in Step 8 — should show `permissions: ["order:create"]`
3. Check roles table — waiter role should have order:create permission

**Solution**:
- Verify role-permission assignments in database
- Ensure waiter role has `order:create` permission
- Check if permission system uses outlet-scoped or global permissions

---

### Scenario 3: Add Items Fails (HTTP 404)
**Issue**: Order or food doesn't exist

**Debug Steps**:
1. Did Step 6 succeed? If not, orderId is invalid
2. Did Step 2 return real food IDs? If not, foodId is invalid
3. Check response body for which resource was not found

**Solution**:
- Ensure order was actually created in Step 6
- Ensure food menu items exist for the outlet
- Use food IDs from Step 2 response, not hardcoded values

---

### Scenario 4: Tables Fetch Returns Empty Array
**Issue**: No dining tables exist or waiter not assigned

**Debug Steps**:
1. Check if dining-tables were seeded in database
2. Check if tables are outlet-scoped (filtering by waiter's outlet)
3. Check if tables are soft-deleted or inactive

**Solution**:
- Seed test data with dining tables
- Verify tables are assigned to the outlet
- Verify tables status is 'available' or 'active'

---

### Scenario 5: Waiter Login Fails
**Issue**: Account not created or activation issue

**Debug Steps**:
1. Check Step 3 response — did user creation succeed?
2. Check Step 3 response — did role assignment succeed?
3. Manually verify user exists: `curl https://api.../users?search=test-waiter`

**Solution**:
- Ensure user creation endpoint is working
- Ensure role assignment completes before login attempt
- Check if users require email verification

---

## Quick Diagnosis Flowchart

```
Run diagnostic test
    ↓
Admin auth OK? → NO → Backend unreachable
    ↓ YES
Tables/Foods/Outlets fetched? → NO → Test data not seeded
    ↓ YES
Waiter account created? → NO → User creation endpoint broken
    ↓ YES
Waiter login OK? → NO → Auth/activation issue
    ↓ YES
Browse tables OK? → NO → RBAC: Missing view permission
    ↓ YES
Create order OK? → NO → RBAC: Missing order:create permission
              OR         Payload: Wrong tableId format
              OR         State: Table unavailable
    ↓ YES
Add items OK? → NO → RBAC: Missing order:edit permission
            OR        Payload: Wrong foodId format
            OR        State: Order in wrong status
    ↓ YES
✓ WORKFLOW COMPLETE
  → 50-VU test should work
  → If 50-VU still fails → investigate concurrency/DB pool
```

## Next Steps After Diagnosis

### If Diagnostic Test Passes ✓
1. The backend API works correctly
2. Test accounts can authenticate
3. Workflows complete end-to-end
4. Run the 50-VU test — if it fails, the issue is concurrency-related (DB pool, race conditions, rate limiting)

### If Diagnostic Test Fails ✗
1. Fix the failed step immediately (don't run 50-VU yet)
2. Common fixes:
   - **HTTP 403**: Grant permissions to waiter/cashier/cook roles
   - **HTTP 404**: Seed test data (tables, foods, outlets)
   - **HTTP 400**: Fix payload structure to match API contract
   - **HTTP 500**: Check backend logs for exceptions
3. Re-run diagnostic test to verify fix
4. Then proceed to 50-VU test

## Running the Test

### Via GitHub Actions
1. Go to: **Actions** → **Diagnostic 1-VU Test**
2. Click **Run workflow**
3. Wait ~2 minutes
4. Check the job logs (not the results file) for detailed output
5. Download artifact for later analysis

### Locally (requires k6 installed)
```bash
export BASE_URL="https://restaurant-management-g6vb.onrender.com/api"
export LOAD_ADMIN_EMAIL="admin@example.com"
export LOAD_ADMIN_PASSWORD="password"
k6 run load-tests/rms-diagnostic-1vu.js
```

## Questions?

When reporting issues, include:
- [ ] Full output from the diagnostic test
- [ ] Which step failed (Step 1-9)
- [ ] HTTP status code of the failure
- [ ] Response body from the failed step
- [ ] Timestamp of the test run
