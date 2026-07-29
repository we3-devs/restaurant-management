import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
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
      name: 'Super Admin',
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

  const user = await upsertUser(
    userRepo,
    seedConfig.adminEmail,
    seedConfig.adminPassword,
    bcryptConfig.saltRounds,
  );
  await upsertGlobalAssignment(assignmentRepo, user.id, role.id);

  logger.log('Seed complete.');
  await app.close();
}

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
