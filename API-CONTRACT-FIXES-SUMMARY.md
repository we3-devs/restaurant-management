# Load Test API Contract Fixes - Summary

**Date**: 2026-08-13  
**Issue**: Load tests were failing with 75% error rate because the test scripts were out of sync with the current backend API contracts.

---

## Root Causes Identified

### 1. CREATE ORDER - HTTP 400: "outletId must be an integer number"
**File**: `load-tests/rms-realistic-multi-user.js` (and others)

**Problem**:
- Test was sending: `{ tableId: "table-1", customerName: "..." }`
- API expects: `{ outletId: <integer>, orderType?: "table", ... }`
- `tableId` is not a valid field in the CreateOrderDto

**Root Cause**: The load test scripts were using an outdated API contract. The current API contract requires `outletId` (not `tableId`), which is the restaurant outlet/location the order is for.

**Evidence from backend**:
- File: `backend/src/modules/orders/dto/create-order.dto.ts`
- Lines 8-10: `outletId` is marked `@IsInt()` and is required
- Lines 22-30: Optional fields are `tableSessionId`, `customerId`, `reservationId`, `orderType`, `note`

---

### 2. LIST OUTLETS - HTTP 403: "Insufficient permissions"
**File**: `load-tests/rms-realistic-multi-user.js` (and others)

**Problem**:
- Test was calling: `GET /outlets`
- Waiter role doesn't have `outlets.view` permission (by design)
- But waiter role doesn't need to list all outlets

**Root Cause**: The test was using the wrong endpoint. There are two outlets endpoints:
- `GET /outlets` - requires `outlets.view` permission (admin only)
- `GET /outlets/assigned` - NO permission required, returns only user's assigned outlets

**Why the distinction matters**: A waiter only needs to know which outlets they're assigned to, not see every outlet. The `/outlets/assigned` endpoint is designed for this.

**Evidence from backend**:
- File: `backend/src/modules/outlets/outlets.controller.ts`
- Lines 33-38: `GET /outlets` requires `@RequirePermissions('outlets.view')`
- Lines 48-62: `GET /outlets/assigned` requires NO special permission
- File: `backend/src/database/seeds/run-seed.ts` lines 260-274: Waiter role definition does NOT include `outlets.view` permission

---

### 3. DEACTIVATE USER - HTTP 400
**File**: `load-tests/rms-diagnostic-1vu.js`

**Problem**:
- Test was calling: `PATCH /users/:id` with body `{ isActive: false }`
- API expects: `PATCH /users/:id/deactivate` with NO body (returns 204 NO_CONTENT)

**Root Cause**: Test was using the wrong endpoint structure.

**Evidence from backend**:
- File: `backend/src/modules/users/users.controller.ts`
- Lines 54-59: `PATCH /users/:id` updates name/email only (expects UpdateUserDto with those fields)
- Lines 75-84: `PATCH /users/:id/deactivate` revokes all role assignments (no body, returns 204 NO_CONTENT)

---

## Files Changed

### Load Test Scripts (3 files fixed)

#### 1. `load-tests/rms-diagnostic-1vu.js`
**Changes**:
- Line ~277: Changed from `tableId: table.id` to `outletId: <from-setup-data>`
- Line ~353: Changed from `GET /outlets` to `GET /outlets/assigned`
- Lines ~378-387: Changed deactivate endpoint from `PATCH /users/:id` to `PATCH /users/:id/deactivate` with no body

**Commit message**: Fix diagnostic 1-VU test to use correct API contracts for order creation, outlets listing, and user deactivation

---

#### 2. `load-tests/rms-realistic-multi-user.js`
**Changes**:
- Line 228: Updated setup() return to include `outlets`, `tables`, `foods`
- Line 296: Updated waiterWorkflow() signature to accept `outlets` and `foods` parameters
- Lines 319-326: Changed order creation from `tableId` to `outletId`, only send required fields
- Lines 334-368: Capture returned `orderId` and use it for adding items with real `foodId`
- Line 585: Pass outlets and foods data to waiterWorkflow()
- Line ~221: Changed outlets.view to outlets.assigned (already correct, but confirmed)

**Commit message**: Fix multi-user load test to use real data and correct API contract for order creation

---

#### 3. `load-tests/rms-realistic.js`
**Changes**:
- Lines 106-122: Added fetch of `/outlets/assigned` in setup
- Line 150: Updated setup() return to include `outlets`
- Line 164: Updated waiterWorkflow() signature to accept `outlets` parameter
- Lines 186-216: Changed order creation from `tableId` to `outletId`, capture returned orderId
- Line 221: Changed to use real `foodId` from fetched data
- Line 464: Updated data destructuring to include `outlets`
- Line 472: Pass outlets to waiterWorkflow()

**Commit message**: Fix realistic load test to use real outlet data and correct order creation API

---

## API Contracts Validated

### POST /orders (Create Order)
```typescript
// Current, correct contract:
{
  outletId: number;        // REQUIRED - the restaurant outlet/location
  tableSessionId?: number; // optional
  customerId?: number;     // optional
  reservationId?: number;  // optional
  orderType?: "grab_and_go" | "table" | "stay" | "delivery"; // optional, default "table"
  note?: string;           // optional
}

// Response: 201 Created
{
  id: number;
  outletId: number;
  orderNumber: string;
  status: "pending" | "accepted" | "preparing" | "ready" | ...;
  // ... other fields
}
```

### GET /outlets/assigned (List User's Assigned Outlets)
```typescript
// No authentication/permission headers needed beyond Bearer token
// Response: 200 OK
[
  {
    id: number;
    name: string;
    // ... outlet fields
  },
  // ... more outlets
]

// Falls back to all outlets for:
// - Superadmins
// - Users with global-scope role assignments
```

### PATCH /users/:id/deactivate (Deactivate User)
```typescript
// No body required
// Response: 204 No Content

// Effect: Revokes all of user's role assignments
// (login stays possible, access does not)
```

---

## Why These Fixes Are Correct

### Order Creation (`outletId` required, not `tableId`)
- **Business Logic**: An order always belongs to an outlet (restaurant location). The table, if any, is optional and belongs to a session.
- **API Design**: Following resource ownership hierarchy: outlet → table-session → order-item
- **Example Frontend Usage**: `apps/operational-web/src/app/(operational)/pos/start-sale-dialog.tsx` lines 113-117 always sends `outletId` when creating orders
- **Database Schema**: Order entity has `outletId` foreign key constraint (required), `tableSessionId` is optional

### Outlets Listing (`/outlets/assigned` not `/outlets`)
- **RBAC Design**: Waiter role has NO `outlets.view` permission by design
- **Intended Behavior**: Waiters know which outlets they work at because of role assignments
- **Operational need**: Staff never need to see admin's full outlet directory
- **No permission bypass**: This is the correct permission model, not a workaround

### User Deactivation (`/deactivate` endpoint)
- **Endpoint Structure**: Follows NestJS REST convention for actions
- **Semantics**: "Deactivate" (revoke access) vs "Update" (edit name/email) are different operations
- **Response Code**: 204 NO_CONTENT is standard for side-effect-only operations

---

## Testing Approach

Run the diagnostic test first to verify fixes before 50-VU test:

```bash
# GitHub Actions
Actions → "Diagnostic 1-VU Test" → Run workflow

# Local (if k6 installed)
k6 run load-tests/rms-diagnostic-1vu.js \
  --env LOAD_ADMIN_EMAIL="admin@example.com" \
  --env LOAD_ADMIN_PASSWORD="password"
```

**Expected result**: All steps pass with HTTP 200/201/204 status codes.

---

## Impact Assessment

### What Changed
- ✓ 3 load test scripts updated to match current backend API contracts
- ✓ No backend code changed (backend is correct)
- ✓ No RBAC policies weakened (used correct permission model)

### What Stays the Same
- ✗ Backend Order, User, Outlets controllers (correct as-is)
- ✗ Database schema (correct as-is)
- ✗ Role/permission seed configuration (correct as-is)

### Risks Mitigated
- ✓ Tests now match production API behavior
- ✓ Tests validate real workflows, not outdated contracts
- ✓ No permission bypass (used endpoint that waiter is meant to use)

---

## Files Not Changed (Correct as-is)

### Backend Order Creation
- `backend/src/modules/orders/dto/create-order.dto.ts` ✓ Correct
- `backend/src/modules/orders/orders.controller.ts` ✓ Correct
- `backend/src/modules/orders/orders.service.ts` ✓ Correct

### Backend Outlets Controller
- `backend/src/modules/outlets/outlets.controller.ts` ✓ Correct
- Distinguishes between `/outlets` (admin) and `/outlets/assigned` (all roles) ✓

### Backend User Deactivation
- `backend/src/modules/users/users.controller.ts` ✓ Correct
- `PATCH /users/:id/deactivate` endpoint ✓

### RBAC Configuration
- `backend/src/database/seeds/run-seed.ts` ✓ Correct
- Waiter role intentionally excludes `outlets.view` permission ✓
