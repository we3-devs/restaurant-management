import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../entities/audit-log.entity';

export const AUDIT_KEY = 'auditMetadata';

export interface AuditMetadata {
  action: AuditAction;
  entityType: string;
}

/** Pairs with @UseInterceptors(AuditInterceptor) — see audit.interceptor.ts for why this isn't a global APP_INTERCEPTOR. */
export const Audit = (action: AuditAction, entityType: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType } as AuditMetadata);
