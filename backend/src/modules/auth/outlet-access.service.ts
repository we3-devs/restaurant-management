import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

export const ALL_OUTLETS = 'ALL' as const;
export type AccessibleOutlets = number[] | typeof ALL_OUTLETS;

/**
 * Single source of truth for "which outlets can this user touch". Wraps
 * PermissionsService.getAccessibleOutletIds (whose empty-array result means
 * "only global/unscoped assignments" per its own doc) plus the superadmin
 * bypass every other guard in this app already grants, so callers get one
 * unambiguous ALL_OUTLETS sentinel instead of re-deriving that meaning
 * themselves at each call site.
 */
@Injectable()
export class OutletAccessService {
  constructor(private readonly permissionsService: PermissionsService) {}

  async getAccessibleOutletIds(
    userId: number,
    isSuperadmin: boolean,
  ): Promise<AccessibleOutlets> {
    if (isSuperadmin) {
      return ALL_OUTLETS;
    }
    const outletIds = await this.permissionsService.getAccessibleOutletIds(
      userId,
    );
    return outletIds.length === 0 ? ALL_OUTLETS : outletIds;
  }

  async canAccessOutlet(
    userId: number,
    isSuperadmin: boolean,
    outletId: number,
  ): Promise<boolean> {
    const accessible = await this.getAccessibleOutletIds(userId, isSuperadmin);
    return accessible === ALL_OUTLETS || accessible.includes(outletId);
  }

  async assertOutletAccess(
    userId: number,
    isSuperadmin: boolean,
    outletId: number,
  ): Promise<void> {
    const allowed = await this.canAccessOutlet(userId, isSuperadmin, outletId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this outlet');
    }
  }
}
