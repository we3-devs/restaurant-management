import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Queue } from 'bullmq';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';

/**
 * Registered per-controller via @UseInterceptors(AuditInterceptor) rather than
 * globally as an APP_INTERCEPTOR — it needs the `audit-log-write` queue
 * injected, which is simplest to wire up by exporting it from
 * AuditLogsModule and importing that module wherever @Audit() is used.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @InjectQueue('audit-log-write') private readonly queue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id ?? null;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap((response: { id?: string | number } | undefined) => {
        const entityId =
          response?.id ?? (request.params?.id as string | undefined) ?? null;
        void this.queue.add('write', {
          userId,
          action: metadata.action,
          entityType: metadata.entityType,
          entityId,
          newValues: response,
          ipAddress,
          userAgent,
        });
      }),
    );
  }
}
