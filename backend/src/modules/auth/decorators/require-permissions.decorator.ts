import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** Applies with PermissionsGuard: @RequirePermissions('users.view', 'users.manage') requires ALL listed slugs. */
export const RequirePermissions = (...permissionSlugs: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissionSlugs);
