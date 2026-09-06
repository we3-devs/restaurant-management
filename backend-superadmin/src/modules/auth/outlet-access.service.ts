import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { PermissionsService } from './permissions.service';

export const ALL_OUTLETS = 'ALL' as const;
export type AccessibleOutlets = number[] | typeof ALL_OUTLETS;

/**
 * Single source of truth for "which outlets can this user touch". Wraps
 * PermissionsService.getAccessibleOutletIds — which returns `null` for a
 * user with zero active role assignments and `[]` for a user whose
 * assignment(s) are all global/unscoped — plus the superadmin bypass every
 * other guard in this app already grants, so callers get one unambiguous
 * ALL_OUTLETS sentinel (or a genuinely empty list, meaning "no outlets")
 * instead of re-deriving that meaning themselves at each call site.
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
    if (outletIds === null) {
      // Zero active role assignments — not "global", just no access.
      return [];
    }
    return outletIds;
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

  /** Resolves a reporting request to one safe active outlet. Undefined means all outlets for a superadmin. */
  async resolveReportingOutlet(user: User, requestedOutletId?: number): Promise<number | undefined> {
    const accessible = await this.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (requestedOutletId !== undefined) {
      await this.assertOutletAccess(user.id, user.isSuperadmin, requestedOutletId);
      return requestedOutletId;
    }
    if (accessible === ALL_OUTLETS) return undefined;
    if (accessible.length === 0) throw new ForbiddenException('You do not have access to any outlet');
    return accessible[0];
  }

  assertSuperadmin(user: User): void {
    if (!user.isSuperadmin) throw new ForbiddenException('Only a superadmin may perform this operation');
  }
}
