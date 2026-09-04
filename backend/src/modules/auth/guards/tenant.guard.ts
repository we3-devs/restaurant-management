import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Binds a verified tenant hostname to an outlet the authenticated user can
 * access. The browser-facing Next proxy overwrites X-Tenant-Slug from Host;
 * this guard is the backend safety net for direct API callers.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { tenantOutletId?: number }>();
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    if (!slug) return true;

    const user = request.user;
    if (!user) throw new ForbiddenException('Tenant context requires authentication');

    const rows = await this.dataSource.query(
      `SELECT o.id
       FROM outlets o
       WHERE o.slug = $1
         AND ($2 = true OR EXISTS (
           SELECT 1 FROM user_role_assignments ura
           WHERE ura.user_id = $3
             AND ura.is_active = true
             AND (ura.starts_at IS NULL OR ura.starts_at <= now())
             AND (ura.ends_at IS NULL OR ura.ends_at > now())
             AND (ura.outlet_id = o.id OR ura.outlet_id IS NULL)
         ))
       LIMIT 1`,
      [slug, Boolean(user.isSuperadmin), user.id],
    );

    if (!rows[0]) throw new ForbiddenException('You do not have access to this tenant');
    request.tenantOutletId = Number(rows[0].id);
    return true;
  }
}
