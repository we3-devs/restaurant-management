import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { AuditLogsService } from '../audit-logs.service';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';
import { AuditAction } from '../entities/audit-log.entity';

const METHOD_ACTION: Partial<Record<string, AuditAction>> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'twofactorsecret',
  'twofactorrecoverycodes',
]);

const MAX_JSON_LENGTH = 8000;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 4) return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : sanitize(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** PascalCase controller class name -> kebab-case entity type, e.g. "PurchaseOrdersController" -> "purchase-orders". */
function entityTypeFromController(controllerName: string): string {
  return controllerName
    .replace(/Controller$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Registered globally (see AuditLogsModule) so every mutating request
 * (POST/PUT/PATCH/DELETE) leaves an activity-trail row without each
 * controller having to opt in by hand. `@Audit()` still lets a route
 * override the inferred action/entityType with a precise one; `@SkipAudit()`
 * opts a route out entirely (routes that already record a richer entry
 * themselves, or that are too low-signal to be worth logging).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method?.toUpperCase();
    const inferredAction = METHOD_ACTION[method];
    if (!inferredAction) {
      // GET/HEAD/OPTIONS — reads aren't activity to log.
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const action = metadata?.action ?? inferredAction;
    const entityType = metadata?.entityType ?? entityTypeFromController(context.getClass().name);

    const userId = request.user?.id ?? null;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap((response: { id?: string | number } | undefined) => {
        const entityId =
          response?.id ?? (request.params?.id as string | undefined) ?? null;
        const newValues = sanitize(response);
        const serialized = newValues ? JSON.stringify(newValues) : null;
        void this.auditLogsService
          .record({
            userId,
            action,
            entityType,
            entityId,
            newValues: serialized && serialized.length > MAX_JSON_LENGTH ? { truncated: true } : newValues,
            ipAddress,
            userAgent,
          })
          .catch((err: Error) => this.logger.error(`Audit write failed: ${err.message}`));
      }),
    );
  }
}
