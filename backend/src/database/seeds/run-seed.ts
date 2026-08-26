import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { Position } from '../../modules/employees/entities/position.entity';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import type { PortalAccess } from '../../modules/roles/entities/portal-access';
import { Role } from '../../modules/roles/entities/role.entity';
import type { ScopeLevel } from '../../modules/roles/entities/scope-level';
import { UserRoleAssignment } from '../../modules/roles/entities/user-role-assignment.entity';
import { User } from '../../modules/users/entities/user.entity';
import { SeedModule } from './seed.module';

const logger = new Logger('Seed');

async function upsertRole(repo: Repository<Role>): Promise<Role> {
  let role = await repo.findOne({ where: { slug: 'super-admin' } });
  if (!role) {
    role = repo.create({
      name: 'Super Admin',
      slug: 'super-admin',
      level: 'global',
      rank: 1,
      isAssignable: true,
      isSystem: true,
      isActive: true,
      description: 'Full-access system role seeded for the foundation phase.',
    });
    role = await repo.save(role);
    logger.log(`Created role "${role.slug}"`);
  } else {
    logger.log(`Role "${role.slug}" already exists, skipping`);
  }
  return role;
}

async function upsertPermission(
  repo: Repository<Permission>,
  slug: string,
  name: string,
  module: string,
  action: string,
): Promise<Permission> {
  let permission = await repo.findOne({ where: { slug } });
  if (!permission) {
    permission = repo.create({
      name,
      slug,
      module,
      action,
      level: 'global',
      isSystem: true,
      isActive: true,
    });
    permission = await repo.save(permission);
    logger.log(`Created permission "${permission.slug}"`);
  } else {
    logger.log(`Permission "${permission.slug}" already exists, skipping`);
  }
  return permission;
}

async function upsertRolePermission(
  repo: Repository<RolePermission>,
  roleId: number,
  permissionId: number,
): Promise<void> {
  const existing = await repo.findOne({ where: { roleId, permissionId } });
  if (!existing) {
    await repo.save(repo.create({ roleId, permissionId }));
    logger.log(`Linked role ${roleId} -> permission ${permissionId}`);
  }
}

/** Removes a stale role->permission grant, e.g. a slug a role used to need before its permissions were split more finely. Unlike the upserts above, this makes the seed script also fix already-provisioned databases, not just fresh ones. */
async function revokeRolePermissionBySlug(
  permissionRepo: Repository<Permission>,
  rolePermissionRepo: Repository<RolePermission>,
  roleId: number,
  slug: string,
): Promise<void> {
  const permission = await permissionRepo.findOne({ where: { slug } });
  if (!permission) return;
  const existing = await rolePermissionRepo.findOne({ where: { roleId, permissionId: permission.id } });
  if (existing) {
    await rolePermissionRepo.remove(existing);
    logger.log(`Revoked permission "${slug}" from role ${roleId}`);
  }
}

async function upsertModulePermissions(
  permissionRepo: Repository<Permission>,
  rolePermissionRepo: Repository<RolePermission>,
  roleId: number,
  module: string,
  label: string,
): Promise<void> {
  const viewPermission = await upsertPermission(
    permissionRepo,
    `${module}.view`,
    `View ${label}`,
    module,
    'view',
  );
  const managePermission = await upsertPermission(
    permissionRepo,
    `${module}.manage`,
    `Manage ${label}`,
    module,
    'manage',
  );
  await upsertRolePermission(rolePermissionRepo, roleId, viewPermission.id);
  await upsertRolePermission(rolePermissionRepo, roleId, managePermission.id);
}

function titleCase(slug: string): string {
  return slug.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

async function upsertOperationalRole(
  repo: Repository<Role>,
  input: {
    slug: string;
    name: string;
    rank: number;
    description: string;
    level?: ScopeLevel;
    portal: PortalAccess;
  },
): Promise<Role> {
  let role = await repo.findOne({ where: { slug: input.slug } });
  if (!role) {
    role = repo.create({
      name: input.name,
      slug: input.slug,
      level: input.level ?? 'outlet',
      rank: input.rank,
      isAssignable: true,
      portal: input.portal,
      isSystem: false,
      isActive: true,
      description: input.description,
    });
    role = await repo.save(role);
    logger.log(`Created role "${role.slug}"`);
  } else if (role.portal !== input.portal) {
    // Re-running the seed against an already-provisioned DB should still fix
    // the portal on roles that predate this column, same as revokePermissions
    // above tightens permissions on re-run.
    role.portal = input.portal;
    role = await repo.save(role);
    logger.log(`Updated role "${role.slug}" portal -> ${input.portal}`);
  } else {
    logger.log(`Role "${role.slug}" already exists, skipping`);
  }
  return role;
}

/** Creates the permission if missing (module/action inferred from the slug) and grants it to the role. */
async function grantPermissionSlug(
  permissionRepo: Repository<Permission>,
  rolePermissionRepo: Repository<RolePermission>,
  roleId: number,
  slug: string,
  name: string,
): Promise<void> {
  const [module, action] = slug.split('.');
  const permission = await upsertPermission(permissionRepo, slug, name, module, action);
  await upsertRolePermission(rolePermissionRepo, roleId, permission.id);
}

async function upsertPosition(
  repo: Repository<Position>,
  input: { name: string; slug: string; description: string; defaultRoleId: number },
): Promise<Position> {
  let position = await repo.findOne({ where: { slug: input.slug } });
  if (!position) {
    position = repo.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      defaultRoleId: input.defaultRoleId,
      isActive: true,
    });
    position = await repo.save(position);
    logger.log(`Created position "${position.slug}"`);
  } else if (position.defaultRoleId !== input.defaultRoleId) {
    position.defaultRoleId = input.defaultRoleId;
    position = await repo.save(position);
    logger.log(`Linked position "${position.slug}" -> role ${input.defaultRoleId}`);
  } else {
    logger.log(`Position "${position.slug}" already exists, skipping`);
  }
  return position;
}

interface RoleSeed {
  slug: string;
  name: string;
  rank: number;
  description: string;
  /** Which frontend app holders of this role land in after login. */
  portal: PortalAccess;
  /** Grants both {module}.view and {module}.manage. */
  fullModules: string[];
  /** Grants a single already-namespaced permission slug, e.g. "dashboard.view". */
  singlePermissions: string[];
  /** Removes a permission slug this role used to have, so re-running the seed against an already-provisioned DB actually tightens it. */
  revokePermissions?: string[];
  position: { name: string; slug: string; description: string };
}

const OPERATIONAL_ROLES: RoleSeed[] = [
  {
    slug: 'manager',
    name: 'Manager',
    rank: 20,
    description: 'Outlet manager — full operational access short of user/role administration.',
    portal: 'dashboard',
    fullModules: [
      'orders', 'order-payments', 'table-sessions', 'dining-tables', 'dining-areas',
      'reservations', 'customers', 'employees', 'shifts', 'attendance',
      'suppliers', 'purchase-orders', 'goods-receiving', 'purchase-returns', 'supplier-payments',
      'foods', 'food-categories', 'food-variants', 'addon-groups', 'addons',
      'ingredients', 'ingredient-categories', 'units',
      'stock-ins', 'stock-outs', 'stock-transfers', 'stock-adjustments', 'stock-counts', 'ingredient-wastages',
      'loyalty', 'customer-credit', 'settings',
    ],
    singlePermissions: [
      'dashboard.view', 'reports.view', 'inventory-stock.view', 'audit-logs.view',
      'outlets.view', 'warehouses.view', 'outlet-departments.view', 'kitchen-tickets.manage',
    ],
    position: { name: 'Manager', slug: 'manager', description: 'Runs day-to-day outlet operations.' },
  },
  {
    slug: 'cashier',
    name: 'Cashier',
    rank: 40,
    description: 'Front-of-house billing and payment collection.',
    portal: 'staff',
    // table-sessions and customers are full modules (not just .view) so a
    // cashier can take payment and assign/change the customer on a table
    // straight from the floor view's table popup, not only through the
    // order-taking flow. The dialog itself still hides start/end/transfer
    // for cashier via a role check (see table-actions-dialog.tsx) — this
    // grant is API-level access, matching the codebase's existing pattern
    // of coarse permission + role-gated UI (see orders.manage below).
    fullModules: ['order-payments', 'orders', 'loyalty', 'table-sessions', 'customers'],
    // dining-areas.view (FloorBoard's area filter) and foods/food-categories/
    // food-variants.view (FoodGrid, CategoryTabs, VariantPickerDialog on the
    // Billing screen) are all read by the same order-taking flow every
    // orders.manage role goes through — see waiter/bartender below.
    // addons.view/outlets.view/settings.view — BillReceipt (bill panel,
    // POS receipt, invoice view) reads addon names, the outlet name and
    // Settings > POS header/footer text; without these the receipt was
    // silently rendering with addon IDs and blank branding instead of 403ing
    // loudly, since every field there has a fallback.
    singlePermissions: [
      'dining-tables.view', 'dining-areas.view', 'dashboard.view',
      'foods.view', 'food-categories.view', 'food-variants.view', 'customer-credit.view',
      'addons.view', 'outlets.view', 'settings.view',
    ],
    // Stale grants from an earlier version of this role definition, unused by
    // any cashier-reachable screen.
    revokePermissions: ['outlet-departments.view', 'shifts.view'],
    position: { name: 'Cashier', slug: 'cashier', description: 'Handles billing, payments and loyalty redemption at the counter.' },
  },
  {
    slug: 'waiter',
    name: 'Waiter',
    rank: 50,
    description: 'Front-of-house service — takes orders, manages tables, settles bills.',
    portal: 'staff',
    fullModules: ['orders', 'order-payments', 'table-sessions', 'reservations'],
    // foods/food-categories/food-variants.view — same order-taking flow as
    // cashier above (FoodGrid, CategoryTabs, VariantPickerDialog).
    singlePermissions: [
      'dining-tables.view', 'dining-areas.view', 'customers.view', 'loyalty.view', 'dashboard.view',
      'foods.view', 'food-categories.view', 'food-variants.view', 'customer-credit.view',
      'addons.view', 'outlets.view', 'settings.view',
    ],
    position: { name: 'Waiter', slug: 'waiter', description: 'Takes orders, serves tables, settles bills.' },
  },
  {
    slug: 'bartender',
    name: 'Bartender',
    rank: 50,
    description: 'Bar orders and drink service.',
    portal: 'staff',
    fullModules: ['orders', 'order-payments'],
    // dining-areas/table-sessions/foods/food-categories/food-variants.view —
    // same order-taking flow as cashier/waiter above (FloorBoard, FoodGrid,
    // CategoryTabs, VariantPickerDialog, StartSaleDialog).
    singlePermissions: [
      'ingredients.view', 'dining-tables.view', 'dining-areas.view', 'table-sessions.view', 'kitchen-tickets.manage',
      'foods.view', 'food-categories.view', 'food-variants.view',
      'addons.view', 'outlets.view', 'settings.view',
    ],
    position: { name: 'Bartender', slug: 'bartender', description: 'Prepares and serves drink orders at the bar.' },
  },
  {
    slug: 'host',
    name: 'Host / Hostess',
    rank: 50,
    description: 'Guest seating and reservation management.',
    portal: 'staff',
    fullModules: ['reservations', 'table-sessions'],
    singlePermissions: ['dining-tables.view', 'dining-areas.view', 'customers.view'],
    position: { name: 'Host/Hostess', slug: 'host-hostess', description: 'Greets guests, manages the seating queue and reservations.' },
  },
  {
    slug: 'cook',
    name: 'Cook',
    rank: 50,
    description: 'Kitchen staff — prepares food and logs ingredient wastage.',
    portal: 'staff',
    // Not fullModules: ['orders'] — that grants orders.manage, which is for
    // taking/editing orders at the POS, not for running the KDS board. Cooks
    // get orders.view (see tickets) + kitchen-tickets.manage (act on them).
    fullModules: ['ingredient-wastages'],
    singlePermissions: [
      'orders.view', 'kitchen-tickets.manage',
      'ingredients.view', 'ingredient-categories.view', 'inventory-stock.view', 'stock-outs.view', 'units.view',
    ],
    // foods/food-categories/food-variants — leftover menu-management grants
    // from an earlier role definition; the KDS board (staff/kitchen) never
    // reads the menu, only kitchen-tickets, so a cook editing the menu was
    // never intentional.
    revokePermissions: [
      'orders.manage',
      'foods.manage', 'foods.view',
      'food-categories.manage', 'food-categories.view',
      'food-variants.manage', 'food-variants.view',
    ],
    position: { name: 'Cook', slug: 'cook', description: 'Prepares kitchen orders.' },
  },
  {
    slug: 'housekeeping',
    name: 'Housekeeping',
    rank: 60,
    description: 'Table and dining-area upkeep between seatings.',
    portal: 'staff',
    fullModules: ['dining-tables'],
    singlePermissions: ['dining-areas.view', 'table-sessions.view', 'attendance.view', 'shifts.view'],
    position: { name: 'Housekeeping Staff', slug: 'housekeeping', description: 'Cleans and resets tables and dining areas between seatings.' },
  },
  {
    slug: 'kitchen-helper',
    name: 'Kitchen Helper',
    rank: 70,
    description: 'Dishwashing and kitchen support.',
    portal: 'staff',
    fullModules: [],
    singlePermissions: ['orders.view', 'attendance.view', 'shifts.view'],
    position: { name: 'Dishwasher', slug: 'dishwasher', description: 'Kitchen support — dishwashing and cleaning.' },
  },
];

async function seedOperationalRolesAndPositions(
  roleRepo: Repository<Role>,
  permissionRepo: Repository<Permission>,
  rolePermissionRepo: Repository<RolePermission>,
  positionRepo: Repository<Position>,
): Promise<void> {
  for (const seed of OPERATIONAL_ROLES) {
    const role = await upsertOperationalRole(roleRepo, seed);

    for (const module of seed.fullModules) {
      await upsertModulePermissions(permissionRepo, rolePermissionRepo, role.id, module, titleCase(module));
    }
    for (const slug of seed.singlePermissions) {
      await grantPermissionSlug(permissionRepo, rolePermissionRepo, role.id, slug, titleCase(slug.split('.')[0]));
    }
    for (const slug of seed.revokePermissions ?? []) {
      await revokeRolePermissionBySlug(permissionRepo, rolePermissionRepo, role.id, slug);
    }

    await upsertPosition(positionRepo, { ...seed.position, defaultRoleId: role.id });
  }
}

async function upsertUser(
  repo: Repository<User>,
  email: string,
  rawPassword: string,
  saltRounds: number,
): Promise<User> {
  let user = await repo.findOne({ where: { email } });
  if (!user) {
    const password = await bcrypt.hash(rawPassword, saltRounds);
    user = repo.create({
      name: process.env.SEED_ADMIN_NAME ?? 'Super Admin',
      email,
      password,
      isSuperadmin: true,
    });
    user = await repo.save(user);
    logger.log(`Created user "${user.email}"`);
  } else {
    logger.log(`User "${user.email}" already exists, skipping`);
  }
  return user;
}

async function upsertGlobalAssignment(
  repo: Repository<UserRoleAssignment>,
  userId: number,
  roleId: number,
): Promise<void> {
  const existing = await repo.findOne({
    where: {
      userId,
      roleId,
      scopeType: 'global',
      outletId: IsNull(),
      outletDepartmentId: IsNull(),
      warehouseId: IsNull(),
    },
  });
  if (!existing) {
    await repo.save(
      repo.create({ userId, roleId, scopeType: 'global', isActive: true }),
    );
    logger.log(`Assigned role ${roleId} to user ${userId} at global scope`);
  }
}

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const configService = app.get(ConfigService<AppConfig>);
  const seedConfig = configService.get('seed', { infer: true })!;
  const bcryptConfig = configService.get('bcrypt', { infer: true })!;

  const roleRepo = app.get<Repository<Role>>(getRepositoryToken(Role));
  const permissionRepo = app.get<Repository<Permission>>(
    getRepositoryToken(Permission),
  );
  const rolePermissionRepo = app.get<Repository<RolePermission>>(
    getRepositoryToken(RolePermission),
  );
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const assignmentRepo = app.get<Repository<UserRoleAssignment>>(
    getRepositoryToken(UserRoleAssignment),
  );
  const positionRepo = app.get<Repository<Position>>(getRepositoryToken(Position));

  const role = await upsertRole(roleRepo);
  const usersViewPermission = await upsertPermission(
    permissionRepo,
    'users.view',
    'View Users',
    'users',
    'view',
  );
  const usersManagePermission = await upsertPermission(
    permissionRepo,
    'users.manage',
    'Manage Users',
    'users',
    'manage',
  );
  const rolesViewPermission = await upsertPermission(
    permissionRepo,
    'roles.view',
    'View Roles',
    'roles',
    'view',
  );
  const rolesManagePermission = await upsertPermission(
    permissionRepo,
    'roles.manage',
    'Manage Roles',
    'roles',
    'manage',
  );
  const outletsViewPermission = await upsertPermission(
    permissionRepo,
    'outlets.view',
    'View Outlets',
    'outlets',
    'view',
  );
  const outletsManagePermission = await upsertPermission(
    permissionRepo,
    'outlets.manage',
    'Manage Outlets',
    'outlets',
    'manage',
  );
  const outletDepartmentsViewPermission = await upsertPermission(
    permissionRepo,
    'outlet-departments.view',
    'View Outlet Departments',
    'outlet-departments',
    'view',
  );
  const outletDepartmentsManagePermission = await upsertPermission(
    permissionRepo,
    'outlet-departments.manage',
    'Manage Outlet Departments',
    'outlet-departments',
    'manage',
  );
  const warehousesViewPermission = await upsertPermission(
    permissionRepo,
    'warehouses.view',
    'View Warehouses',
    'warehouses',
    'view',
  );
  const warehousesManagePermission = await upsertPermission(
    permissionRepo,
    'warehouses.manage',
    'Manage Warehouses',
    'warehouses',
    'manage',
  );

  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    usersViewPermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    usersManagePermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    rolesViewPermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    rolesManagePermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    outletsViewPermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    outletsManagePermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    outletDepartmentsViewPermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    outletDepartmentsManagePermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    warehousesViewPermission.id,
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    warehousesManagePermission.id,
  );

  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'food-categories',
    'Food Categories',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'foods',
    'Foods',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'food-variants',
    'Food Variants',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'addon-groups',
    'Addon Groups',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'addons',
    'Addons',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'dining-areas',
    'Dining Areas',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'dining-tables',
    'Dining Tables',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'table-sessions',
    'Table Sessions',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'orders',
    'Orders',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'order-payments',
    'Order Payments',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'units',
    'Units',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'ingredient-categories',
    'Ingredient Categories',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'ingredients',
    'Ingredients',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'stock-ins',
    'Stock-Ins',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'stock-outs',
    'Stock-Outs',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'stock-transfers',
    'Stock Transfers',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'ingredient-wastages',
    'Ingredient Wastages',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'stock-adjustments',
    'Stock Adjustments',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'stock-counts',
    'Stock Counts',
  );
  const inventoryStockViewPermission = await upsertPermission(
    permissionRepo,
    'inventory-stock.view',
    'View Inventory Stock & Ledger',
    'inventory-stock',
    'view',
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    inventoryStockViewPermission.id,
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'customers',
    'Customers',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'reservations',
    'Reservations',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'suppliers',
    'Suppliers',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'purchase-orders',
    'Purchase Orders',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'goods-receiving',
    'Goods Receiving',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'purchase-returns',
    'Purchase Returns',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'supplier-payments',
    'Supplier Payments',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'employees',
    'Employees',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'shifts',
    'Shifts',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'attendance',
    'Attendance',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'staff-reports',
    'Staff Reports',
  );
  const dashboardViewPermission = await upsertPermission(
    permissionRepo,
    'dashboard.view',
    'View Dashboard',
    'dashboard',
    'view',
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    dashboardViewPermission.id,
  );
  const reportsViewPermission = await upsertPermission(
    permissionRepo,
    'reports.view',
    'View Reports',
    'reports',
    'view',
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    reportsViewPermission.id,
  );

  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'settings',
    'Settings',
  );
  const auditLogsViewPermission = await upsertPermission(
    permissionRepo,
    'audit-logs.view',
    'View Audit Logs',
    'audit-logs',
    'view',
  );
  await upsertRolePermission(
    rolePermissionRepo,
    role.id,
    auditLogsViewPermission.id,
  );

  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'loyalty',
    'Loyalty',
  );
  await upsertModulePermissions(
    permissionRepo,
    rolePermissionRepo,
    role.id,
    'customer-credit',
    'Customer Credit',
  );

  const user = await upsertUser(
    userRepo,
    seedConfig.adminEmail,
    seedConfig.adminPassword,
    bcryptConfig.saltRounds,
  );
  await upsertGlobalAssignment(assignmentRepo, user.id, role.id);

  await seedOperationalRolesAndPositions(roleRepo, permissionRepo, rolePermissionRepo, positionRepo);

  logger.log('Seed complete.');
  await app.close();
}

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
