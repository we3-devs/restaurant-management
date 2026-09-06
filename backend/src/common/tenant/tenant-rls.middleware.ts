import { Injectable, NestMiddleware } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantRlsMiddleware implements NestMiddleware {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async use(request: Request & { tenantId?: number }, _response: Response, next: NextFunction): Promise<void> {
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    if (!slug) {
      this.tenantContext.run(null, next);
      return;
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM tenants WHERE LOWER(slug) = $1 AND is_active = true LIMIT 1`,
      [slug],
    );
    const tenantId = rows[0] ? Number(rows[0].id) : null;
    request.tenantId = tenantId ?? undefined;
    this.tenantContext.run(tenantId, next);
  }
}
