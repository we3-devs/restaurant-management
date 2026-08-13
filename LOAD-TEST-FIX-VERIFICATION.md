# Load Test Fix Verification & Test Plan

## Status

✅ All fixes applied
✅ API contracts validated
✅ Backend code reviewed (no changes needed)
✅ RBAC permissions confirmed correct

---

## What Was Fixed

### Problem Summary
The 50-VU load test was failing with ~75% error rate because:
1. **Order creation API contract mismatch**: Sending `tableId` instead of `outletId`
2. **Outlets permission issue**: Trying to access `/outlets` (requires permission) instead of `/outlets/assigned`
3. **User deactivation endpoint**: Wrong endpoint structure for teardown

### Solution Summary
Fixed 3 load test scripts to match the **current, correct backend API contracts**:
- `load-tests/rms-diagnostic-1vu.js`
- `load-tests/rms-realistic-multi-user.js`
- `load-tests/rms-realistic.js`

No backend changes needed (backend is correct).

---

## Test Execution Plan

### Step 1: Run the 1-VU Diagnostic Test (FIRST)
This validates all fixes without load:

**Via GitHub Actions**:
1. Go to repository → Actions tab
2. Select "Diagnostic 1-VU Test" workflow
3. Click "Run workflow"
4. Wait ~2 minutes
5. Check job logs

**Expected results**:
```
[SETUP] ✓ Admin authenticated
[SETUP] ✓ Found X outlets
[SETUP] ✓ Found X dining tables
[SETUP] ✓ Found X foods
[SETUP] ✓ Created user: user-id-xxx
[TEST] ✓ Admin login: HTTP 200
[TEST] Step 3: Create Order
[TEST] Create order response: HTTP 201
[TEST] ✓ Order created: order-id-xxx
[TEST] Step 4: Add Items to Order
[TEST] Add items response: HTTP 201
[TEST] Step 6: List Assigned Outlets
[TEST] Assigned outlets response: HTTP 200
[TEARDOWN] Deactivate response: HTTP 204
```

✅ = All green → API contracts are fixed

### Step 2: Run 50-VU Multi-User Test (AFTER diagnostic passes)

**Via GitHub Actions**:
1. Go to Actions tab
2. Select "Multi-User Realistic Load Test"
3. Click "Run workflow"
4. Wait ~11 minutes
5. Check results artifact

**Expected results**:
- Error rate < 1% (vs 75% before)
- Order creation should succeed (was 0/126 before)
- Waiter workflows complete end-to-end

---

## Detailed Changes

### File 1: `load-tests/rms-diagnostic-1vu.js`

**Change #1 - Order Creation API (line ~277)**
```javascript
// BEFORE (❌ WRONG)
const createOrderPayload = JSON.stringify({
  tableId: table.id,
  customerName: `Customer-Diagnostic-...`,
});

// AFTER (✅ CORRECT)
const createOrderPayload = JSON.stringify({
  outletId: data.outlets && data.outlets.length > 0 ? data.outlets[0].id : 1,
  orderType: 'table',
});
```

**Why**: The API contract requires `outletId` (integer, outlet/location ID), not `tableId`.

---

**Change #2 - Outlets Listing (line ~353)**
```javascript
// BEFORE (❌ WRONG - requires outlets.view permission)
const outletsRes = http.get(`${BASE_URL}/outlets`, params);

// AFTER (✅ CORRECT - no special permission needed)
const assignedOutletsRes = http.get(`${BASE_URL}/outlets/assigned`, params);
```

**Why**: Waiter role doesn't have `outlets.view` permission. The correct endpoint `/outlets/assigned` returns only user's assigned outlets and requires no special permission.

---

**Change #3 - User Deactivation (line ~378-387)**
```javascript
// BEFORE (❌ WRONG)
const deactivateRes = http.patch(
  `${BASE_URL}/users/${userId}`,
  JSON.stringify({ isActive: false }),
  { headers: {...} }
);

// AFTER (✅ CORRECT)
const deactivateRes = http.patch(
  `${BASE_URL}/users/${userId}/deactivate`,
  null,
  { headers: {...} }
);
```

**Why**: The deactivate endpoint is `/users/:id/deactivate` (not `/users/:id`), takes no body, and returns 204 NO_CONTENT.

---

### File 2: `load-tests/rms-realistic-multi-user.js`

**Change #1 - Setup Return (line 228)**
```javascript
// BEFORE
return { testUsers, adminToken };

// AFTER
return { testUsers, adminToken, outlets, tables, foods };
```

**Why**: Need to pass real data to VU functions so they use actual IDs.

---

**Change #2 - Function Signature (line 296)**
```javascript
// BEFORE
function waiterWorkflow(token, tables) {

// AFTER
function waiterWorkflow(token, outlets, tables, foods) {
```

**Why**: Need access to outlets and foods for creating valid orders and adding real items.

---

**Change #3 - Order Creation (lines 319-326)**
```javascript
// BEFORE
const table = getRandomTable();
const payload = JSON.stringify({
  tableId: table.id,
  customerName: `Customer-...`,
});

// AFTER
const outletId = outlets && outlets.length > 0 ? outlets[0].id : 1;
const payload = JSON.stringify({
  outletId: outletId,
  orderType: 'table',
});
```

**Why**: Use real outlet ID, send only required fields per API contract.

---

**Change #4 - Item Addition (lines 334-368)**
```javascript
// BEFORE - tries to add items to random (non-existent) order ID
const orderId = getRandomOrderId();
const payload = JSON.stringify({
  items: [
    { name: 'Pasta', quantity: 2, price: 450 },
    { name: 'Soda', quantity: 2, price: 150 },
  ],
});

// AFTER - uses real order ID and food ID
if (!orderId) return; // Skip if order creation failed
const food = foods[0];
const payload = JSON.stringify({
  foodId: food.id,
  quantity: 1,
});
```

**Why**: 
- Use the order ID returned from order creation (not random)
- Use real `foodId` from fetched foods (not names/prices)

---

**Change #5 - Pass Data to Workflow (line 585)**
```javascript
// BEFORE
waiterWorkflow(token, []);

// AFTER
waiterWorkflow(token, outlets, tables, foods);
```

**Why**: Pass the real data fetched in setup to the workflow functions.

---

### File 3: `load-tests/rms-realistic.js`

Similar changes as rms-realistic-multi-user.js:
- Fetch outlets in setup using `/outlets/assigned`
- Pass outlets to waiterWorkflow
- Use real `outletId` for order creation
- Use real `foodId` for item addition
- Capture and use returned order ID

---

## Backend Validation

All backend code is correct and requires NO changes:

### ✅ Order Creation DTO
**File**: `backend/src/modules/orders/dto/create-order.dto.ts`
```typescript
export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  outletId: number;  // ✅ Required, integer

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tableSessionId?: number;  // ✅ Optional

  // ... other optional fields
}
```

### ✅ Outlets Controller
**File**: `backend/src/modules/outlets/outlets.controller.ts`
```typescript
// ✅ Admin endpoint - requires outlets.view
@Get()
@RequirePermissions('outlets.view')
findAll(@Query() query: ListOutletsQueryDto) { ... }

// ✅ Waiter endpoint - NO permission required
@Get('assigned')
async findAssigned(@CurrentUser() user: User) { ... }
```

### ✅ User Deactivation
**File**: `backend/src/modules/users/users.controller.ts`
```typescript
// ✅ Correct endpoint and response code
@Patch(':id/deactivate')
@HttpCode(HttpStatus.NO_CONTENT)  // 204
@RequirePermissions('users.manage')
deactivate(@Param('id', ParseIntPipe) id: number) { ... }
```

### ✅ RBAC - Waiter Role
**File**: `backend/src/database/seeds/run-seed.ts` (lines 260-274)
```typescript
{
  slug: 'waiter',
  name: 'Waiter',
  // ...
  fullModules: ['orders', 'order-payments', 'table-sessions', 'reservations'],
  singlePermissions: [
    'dining-tables.view', 'dining-areas.view', 'customers.view',
    'loyalty.view', 'dashboard.view',
    'foods.view', 'food-categories.view', 'food-variants.view',
    // ❌ NOT 'outlets.view' (intentional)
  ],
}
```

Waiter intentionally does NOT have `outlets.view` permission. They access `/outlets/assigned` instead.

---

## Expected Test Results

### Before Fix
```
50-VU Multi-User Test Results:
- Order created: 0/126 (0%)
- Add items: 0/126 (0%)
- Error rate: ~75%
- Failures at: Create Order (HTTP 400)
```

### After Fix
```
50-VU Multi-User Test Results:
- Order created: ~125/126 (99%+)
- Add items: ~125/126 (99%+)
- Error rate: < 1%
- All workflows complete end-to-end
- Latency: p95 < 2s, p99 < 4s
```

---

## Running Tests Locally (if k6 installed)

```bash
# Diagnostic 1-VU test
k6 run load-tests/rms-diagnostic-1vu.js \
  --env LOAD_ADMIN_EMAIL="admin@example.com" \
  --env LOAD_ADMIN_PASSWORD="your-password"

# Realistic multi-user test
k6 run load-tests/rms-realistic-multi-user.js \
  --env LOAD_ADMIN_EMAIL="admin@example.com" \
  --env LOAD_ADMIN_PASSWORD="your-password"

# Realistic single-user test
k6 run load-tests/rms-realistic.js \
  --env LOAD_TEST_EMAIL="waiter@example.com" \
  --env LOAD_TEST_PASSWORD="password"
```

---

## Troubleshooting

### If diagnostic test still fails at Order Creation (HTTP 400)
1. Check that `outlets` array is not empty in setup logs
2. Verify the `outletId` being sent is a valid integer
3. Run backend with logs to see exact validation error

### If 50-VU test still has high error rate
1. Run diagnostic 1-VU first to ensure API contract is working
2. Check per-role error metrics in results (waiter vs kitchen vs cashier)
3. If only one role is failing, check that role's permissions

### If GitHub Actions secrets are missing
1. Add `RMS_ADMIN_EMAIL` and `RMS_ADMIN_PASSWORD` to GitHub Actions secrets
2. Make sure account has superadmin role
3. Verify password doesn't need changing

---

## Sign-Off

- ✅ API contracts verified against backend code
- ✅ RBAC permissions confirmed (no weakening)
- ✅ Load test scripts updated
- ✅ No backend changes needed
- ✅ Ready to run diagnostic test

**Next Step**: Run the diagnostic 1-VU test to verify all fixes work before running 50-VU test.
