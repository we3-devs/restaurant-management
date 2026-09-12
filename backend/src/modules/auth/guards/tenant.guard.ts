import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TENANT_EXEMPT_KEY } from '../decorators/tenant-exempt.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Binds a verified tenant hostname to the authenticated user's tenant. The
 * browser-facing Next proxy overwrites X-Tenant-Slug from Host; this guard is
 * the backend safety net for direct API callers.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { tenantId?: number }>();
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const isTenantExempt = this.reflector.getAllAndOverride<boolean>(TENANT_EXEMPT_KEY, [context.getHandler(), context.getClass()]);

    if (isTenantExempt) return true;

    // Public guest routes still need a resolved tenant. Previously the early
    // @Public() return meant branding, table lookup, and menu requests were
    // always read from the shared/global dataset.
    // Every request handled by the tenant backend must carry an explicit
    // tenant context. Without this, public menu/branding calls could read the
    // fallback/global dataset and authenticated APIs could query unscoped data.
    // Superadmin control-plane calls are the only intentional exception.
    const user = request.user;
    if (!user) {
      if (!isPublic || !slug) throw new ForbiddenException('Tenant context is required');
      const publicTenant = await this.dataSource.query(
        `SELECT id FROM tenants WHERE LOWER(slug) = $1 AND is_active = true LIMIT 1`,
        [slug],
      );
      if (!publicTenant[0]) throw new ForbiddenException('Unknown or inactive tenant');
      request.tenantId = Number(publicTenant[0].id);
      return true;
    }

    if (user.isSuperadmin) {
      if (slug) {
        const selectedTenant = await this.dataSource.query(
          `SELECT id FROM tenants WHERE LOWER(slug) = $1 AND is_active = true LIMIT 1`,
          [slug],
        );
        if (!selectedTenant[0]) throw new ForbiddenException('Unknown or inactive tenant');
        request.tenantId = Number(selectedTenant[0].id);
      }
      return true;
    }

    if (user.tenantId === null) throw new ForbiddenException('Invalid user tenant assignment');
    const userTenant = await this.dataSource.query(
      `SELECT id FROM tenants WHERE id = $1 AND is_active = true LIMIT 1`,
      [user.tenantId],
    );
    if (!userTenant[0]) throw new ForbiddenException('Invalid or inactive user tenant');

    if (slug) {
      const selectedTenant = await this.dataSource.query(
        `SELECT id FROM tenants WHERE LOWER(slug) = $1 AND is_active = true LIMIT 1`,
        [slug],
      );
      if (!selectedTenant[0] || Number(selectedTenant[0].id) !== Number(user.tenantId)) {
        throw new ForbiddenException('You do not have access to this tenant');
      }
    }
    request.tenantId = Number(user.tenantId);
    return true;
  }
}
