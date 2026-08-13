# Creating Test Accounts with Different Roles

Your restaurant management system has a comprehensive role-based access control system. Here's how to create test accounts for different staff roles.

## Available Roles

The system comes pre-seeded with these roles:

| Role | Portal | Description | Best For |
|------|--------|-------------|----------|
| **Super Admin** | Dashboard | Full system access (superadmin flag) | System administrator |
| **Manager** | Dashboard | Outlet operations, reports, inventory | Operations manager |
| **Cashier** | Staff | Billing, payments, loyalty | Cashier/Counter staff |
| **Waiter** | Staff | Order taking, table management, billing | Waitstaff/servers |
| **Bartender** | Staff | Bar orders, drink service | Bartender |
| **Host/Hostess** | Staff | Seating, reservations | Host/hostess |
| **Cook** | Staff | Kitchen orders, food prep | Kitchen staff |
| **Housekeeping** | Staff | Table/area cleaning | Housekeeping staff |
| **Kitchen Helper** | Staff | Dishwashing, support | Kitchen support |

## Quick Setup (REST API)

### Step 1: Get Authorization Token

First, get a token for an admin account (use your super admin account):

```bash
curl -X POST https://restaurant-management-g6vb.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rms.local",
    "password": "your_admin_password"
  }'
```

Response (save the `accessToken`):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "email": "admin@rms.local", ... }
}
```

### Step 2: List Available Roles

Get role IDs so you know what to assign:

```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/roles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response (look for `id` and `slug`):
```json
{
  "data": [
    { "id": 2, "slug": "manager", "name": "Manager", ... },
    { "id": 3, "slug": "cashier", "name": "Cashier", ... },
    { "id": 4, "slug": "waiter", "name": "Waiter", ... },
    { "id": 5, "slug": "cook", "name": "Cook", ... },
    ...
  ]
}
```

**Note:** Save the role IDs for your roles. They're usually:
- Manager: ID 2
- Cashier: ID 3
- Waiter: ID 4
- Cook: ID 5

### Step 3: Create a User

Create a new user account:

```bash
curl -X POST https://restaurant-management-g6vb.onrender.com/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Waiter",
    "email": "john.waiter@rms.local",
    "password": "SecurePass123!"
  }'
```

Response (save the `id`):
```json
{
  "id": 42,
  "name": "John Waiter",
  "email": "john.waiter@rms.local",
  ...
}
```

### Step 4: Assign a Role to the User

Assign the user to a role (e.g., waiter with ID 4):

```bash
curl -X POST https://restaurant-management-g6vb.onrender.com/api/users/42/role-assignments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "roleId": 4
  }'
```

✓ User now has the Waiter role!

## Creating Multiple Test Accounts

Here's a complete example script to create 4 test accounts (one per role):

### Bash Script (`create-test-accounts.sh`)

```bash
#!/bin/bash

# Configuration
API_URL="https://restaurant-management-g6vb.onrender.com/api"
ADMIN_EMAIL="admin@rms.local"
ADMIN_PASSWORD="your_admin_password"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Creating Test Accounts"
echo "=========================================="

# Step 1: Authenticate as admin
echo -e "${BLUE}Step 1: Authenticating as admin...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"

# Step 2: Get role IDs
echo -e "${BLUE}Step 2: Fetching role IDs...${NC}"
ROLES_RESPONSE=$(curl -s -X GET "$API_URL/roles" \
  -H "Authorization: Bearer $TOKEN")

MANAGER_ID=$(echo $ROLES_RESPONSE | jq -r '.data[] | select(.slug=="manager") | .id')
CASHIER_ID=$(echo $ROLES_RESPONSE | jq -r '.data[] | select(.slug=="cashier") | .id')
WAITER_ID=$(echo $ROLES_RESPONSE | jq -r '.data[] | select(.slug=="waiter") | .id')
COOK_ID=$(echo $ROLES_RESPONSE | jq -r '.data[] | select(.slug=="cook") | .id')

echo -e "${GREEN}✓ Roles found: Manager($MANAGER_ID), Cashier($CASHIER_ID), Waiter($WAITER_ID), Cook($COOK_ID)${NC}"

# Function to create user and assign role
create_user_with_role() {
  local name=$1
  local email=$2
  local role_id=$3
  local role_name=$4

  echo ""
  echo -e "${BLUE}Creating $role_name: $name ($email)${NC}"

  # Create user
  USER_RESPONSE=$(curl -s -X POST "$API_URL/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"name\": \"$name\",
      \"email\": \"$email\",
      \"password\": \"TestPass123!\"
    }")

  USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
  if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    echo "❌ Failed to create user"
    echo $USER_RESPONSE | jq '.'
    return 1
  fi

  # Assign role
  ASSIGN_RESPONSE=$(curl -s -X POST "$API_URL/users/$USER_ID/role-assignments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"roleId\": $role_id
    }")

  echo -e "${GREEN}✓ Created: $email (User ID: $USER_ID, Role: $role_name)${NC}"
  echo "   Password: TestPass123!"
}

# Step 3: Create test accounts
echo ""
echo -e "${BLUE}Step 3: Creating test accounts...${NC}"
create_user_with_role "Alice Manager" "alice.manager@rms.local" "$MANAGER_ID" "Manager"
create_user_with_role "Bob Cashier" "bob.cashier@rms.local" "$CASHIER_ID" "Cashier"
create_user_with_role "Charlie Waiter" "charlie.waiter@rms.local" "$WAITER_ID" "Waiter"
create_user_with_role "Diana Cook" "diana.cook@rms.local" "$COOK_ID" "Cook"

echo ""
echo "=========================================="
echo -e "${GREEN}✓ All test accounts created!${NC}"
echo "=========================================="
echo ""
echo "Test Accounts:"
echo "  Manager:  alice.manager@rms.local / TestPass123!"
echo "  Cashier:  bob.cashier@rms.local / TestPass123!"
echo "  Waiter:   charlie.waiter@rms.local / TestPass123!"
echo "  Cook:     diana.cook@rms.local / TestPass123!"
echo ""
```

### PowerShell Script (`create-test-accounts.ps1`)

```powershell
# Configuration
$API_URL = "https://restaurant-management-g6vb.onrender.com/api"
$ADMIN_EMAIL = "admin@rms.local"
$ADMIN_PASSWORD = "your_admin_password"

Write-Host "=========================================="
Write-Host "Creating Test Accounts"
Write-Host "==========================================" -ForegroundColor Cyan

# Step 1: Authenticate
Write-Host "Step 1: Authenticating as admin..." -ForegroundColor Blue
$authBody = @{
    email = $ADMIN_EMAIL
    password = $ADMIN_PASSWORD
} | ConvertTo-Json

$authResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $authBody

$TOKEN = $authResponse.accessToken
if (-not $TOKEN) {
    Write-Host "❌ Authentication failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Authenticated" -ForegroundColor Green

# Step 2: Get role IDs
Write-Host "Step 2: Fetching role IDs..." -ForegroundColor Blue
$rolesResponse = Invoke-RestMethod -Uri "$API_URL/roles" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $TOKEN" }

$MANAGER_ID = ($rolesResponse.data | Where-Object { $_.slug -eq "manager" }).id
$CASHIER_ID = ($rolesResponse.data | Where-Object { $_.slug -eq "cashier" }).id
$WAITER_ID = ($rolesResponse.data | Where-Object { $_.slug -eq "waiter" }).id
$COOK_ID = ($rolesResponse.data | Where-Object { $_.slug -eq "cook" }).id

Write-Host "✓ Roles found: Manager($MANAGER_ID), Cashier($CASHIER_ID), Waiter($WAITER_ID), Cook($COOK_ID)" -ForegroundColor Green

# Function to create user and assign role
function Create-UserWithRole {
    param(
        [string]$Name,
        [string]$Email,
        [int]$RoleId,
        [string]$RoleName
    )

    Write-Host ""
    Write-Host "Creating $RoleName : $Name ($Email)" -ForegroundColor Blue

    # Create user
    $userBody = @{
        name = $Name
        email = $Email
        password = "TestPass123!"
    } | ConvertTo-Json

    $userResponse = Invoke-RestMethod -Uri "$API_URL/users" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Body $userBody

    $USER_ID = $userResponse.id
    if (-not $USER_ID) {
        Write-Host "❌ Failed to create user" -ForegroundColor Red
        return
    }

    # Assign role
    $assignBody = @{ roleId = $RoleId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$API_URL/users/$USER_ID/role-assignments" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $TOKEN" } `
        -Body $assignBody | Out-Null

    Write-Host "✓ Created: $Email (User ID: $USER_ID, Role: $RoleName)" -ForegroundColor Green
    Write-Host "  Password: TestPass123!"
}

# Step 3: Create test accounts
Write-Host ""
Write-Host "Step 3: Creating test accounts..." -ForegroundColor Blue
Create-UserWithRole -Name "Alice Manager" -Email "alice.manager@rms.local" -RoleId $MANAGER_ID -RoleName "Manager"
Create-UserWithRole -Name "Bob Cashier" -Email "bob.cashier@rms.local" -RoleId $CASHIER_ID -RoleName "Cashier"
Create-UserWithRole -Name "Charlie Waiter" -Email "charlie.waiter@rms.local" -RoleId $WAITER_ID -RoleName "Waiter"
Create-UserWithRole -Name "Diana Cook" -Email "diana.cook@rms.local" -RoleId $COOK_ID -RoleName "Cook"

Write-Host ""
Write-Host "=========================================="
Write-Host "✓ All test accounts created!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Accounts:"
Write-Host "  Manager:  alice.manager@rms.local / TestPass123!"
Write-Host "  Cashier:  bob.cashier@rms.local / TestPass123!"
Write-Host "  Waiter:   charlie.waiter@rms.local / TestPass123!"
Write-Host "  Cook:     diana.cook@rms.local / TestPass123!"
Write-Host ""
```

## Using Test Accounts with Load Test

Once you've created test accounts, use them in the load test:

```bash
# For the realistic test with role-based load
LOAD_TEST_EMAIL=alice.manager@rms.local \
LOAD_TEST_PASSWORD=TestPass123! \
BASE_URL=https://restaurant-management-g6vb.onrender.com/api \
k6 run load-tests/rms-realistic.js
```

Or via GitHub Actions workflow (set secrets):
- `RMS_LOAD_TEST_EMAIL`: alice.manager@rms.local
- `RMS_LOAD_TEST_PASSWORD`: TestPass123!

## Via Admin UI (If Available)

If your frontend has an admin panel:

1. Log in as a superadmin account
2. Go to **Users** or **Staff Management**
3. Click **Add New User**
4. Enter details:
   - Name: "John Waiter"
   - Email: "john.waiter@rms.local"
   - Password: "SecurePass123!"
5. Click **Create**
6. Click **Assign Roles**
7. Select "Waiter"
8. Click **Save**

## Role-Specific Test Scenarios

Once you have test accounts, you can test role-specific workflows:

### Manager Account
```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/dashboard \
  -H "Authorization: Bearer MANAGER_TOKEN"
# Can see: Orders, Reports, Inventory, Analytics
```

### Cashier Account
```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/orders \
  -H "Authorization: Bearer CASHIER_TOKEN"
# Can see: Pending orders, Process payments
# Cannot see: Kitchen tickets, Inventory management
```

### Waiter Account
```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/dining-tables \
  -H "Authorization: Bearer WAITER_TOKEN"
# Can see: Tables, Create orders, Reservations
# Cannot see: Payments directly (cashier-only)
```

### Cook Account
```bash
curl -X GET https://restaurant-management-g6vb.onrender.com/api/kitchen/tickets \
  -H "Authorization: Bearer COOK_TOKEN"
# Can see: Kitchen tickets, Order status
# Cannot see: Customer information, Billing
```

## Troubleshooting

### "User already exists"
The email is already in the system. Use a different email or delete the existing user first.

**To delete a user:**
```bash
curl -X PATCH https://restaurant-management-g6vb.onrender.com/api/users/{id}/deactivate \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### "Role not found"
The role ID is incorrect. Run the roles list command again to get correct IDs.

### "Permission denied"
You're not logged in with an admin account. Use your superadmin credentials.

### "Invalid password format"
Passwords must be at least 8 characters. Use something like `SecurePass123!`

## Next Steps

1. ✓ Create test accounts (4 accounts: Manager, Cashier, Waiter, Cook)
2. ✓ Use one account for the realistic load test (recommended: Manager)
3. ✓ Run the load test with that account
4. ✓ Verify all role-based workflows work correctly

---

**Note:** These test accounts are for load testing only. For production, consider using SSO (Single Sign-On) or stronger authentication mechanisms.
