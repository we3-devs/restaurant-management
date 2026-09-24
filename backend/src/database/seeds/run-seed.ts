import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../../modules/employees/entities/position.entity';
import { PositionPermission } from '../../modules/employees/entities/position-permission.entity';
import { Permission } from '../../modules/permissions/entities/permission.entity';
import { SeedModule } from './seed.module';

const logger = new Logger('Seed');

const PERMISSION_MODULES = [
  'users', 'outlets', 'outlet-departments', 'warehouses', 'orders', 'order-payments',
  'table-sessions', 'dining-tables', 'dining-areas', 'reservations', 'customers',
  'employees', 'shifts', 'attendance', 'suppliers', 'purchase-orders', 'goods-receiving',
  'purchase-returns', 'supplier-payments', 'foods', 'food-categories', 'food-variants',
  'addon-groups', 'addons', 'ingredients', 'ingredient-categories', 'units', 'stock-ins',
  'stock-outs', 'stock-transfers', 'stock-adjustments', 'stock-counts', 'ingredient-wastages',
  'loyalty', 'customer-credit', 'settings', 'dashboard', 'reports', 'audit-logs',
  'inventory-stock', 'kitchen-tickets', 'service-requests', 'notifications', 'assistant',
] as const;

// Narrower, discretionary permissions beyond a module's base view/manage
// pair — each gates one specific controller action (see the matching
// permissionsService.hasPermission() call at its call site) and is granted
// to no one but super-admin by default; other positions opt in explicitly
// via Settings > Positions.
const EXTRA_PERMISSIONS: { module: string; action: string; name: string }[] = [
  { module: 'order-payments', action: 'refund', name: 'Issue refunds' },
  { module: 'orders', action: 'delete', name: 'Cancel, force-complete, or delete order items' },
];

async function upsertPermission(
  repo: Repository<Permission>,
  module: string,
  action: string,
  name?: string,
): Promise<Permission> {
  const slug = `${module}.${action}`;
  let permission = await repo.findOne({ where: { slug } });
  if (!permission) {
    permission = await repo.save(repo.create({
      name: name ?? `${action === 'view' ? 'View' : 'Manage'} ${module.replace(/-/g, ' ')}`,
      slug,
      module,
      action,
      level: 'global',
      isSystem: true,
      isActive: true,
      description: null,
    }));
    logger.log(`Created permission "${slug}"`);
  }
  return permission;
}

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const permissionRepo = app.get<Repository<Permission>>(getRepositoryToken(Permission));
  const positionRepo = app.get<Repository<Position>>(getRepositoryToken(Position));
  const positionPermissionRepo = app.get<Repository<PositionPermission>>(getRepositoryToken(PositionPermission));

  const systemPosition = await positionRepo.findOne({ where: { slug: 'super-admin' } });
  for (const module of PERMISSION_MODULES) {
    for (const action of ['view', 'manage']) {
      const permission = await upsertPermission(permissionRepo, module, action);
      if (systemPosition) {
        const exists = await positionPermissionRepo.findOne({ where: { positionId: systemPosition.id, permissionId: permission.id } });
        if (!exists) await positionPermissionRepo.save(positionPermissionRepo.create({ positionId: systemPosition.id, permissionId: permission.id, createdBy: null }));
      }
    }
  }

  for (const { module, action, name } of EXTRA_PERMISSIONS) {
    const permission = await upsertPermission(permissionRepo, module, action, name);
    if (systemPosition) {
      const exists = await positionPermissionRepo.findOne({ where: { positionId: systemPosition.id, permissionId: permission.id } });
      if (!exists) await positionPermissionRepo.save(positionPermissionRepo.create({ positionId: systemPosition.id, permissionId: permission.id, createdBy: null }));
    }
  }

  logger.log('Seed complete. Permissions are position-owned.');
  await app.close();
}

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
