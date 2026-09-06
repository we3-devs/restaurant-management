import { ExecutionContext, Injectable, NestInterceptor, CallHandler } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { operationalRequestContext } from './operational-request-context';

@Injectable()
export class OperationalRequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const raw = request.headers['x-outlet-closed-override'];
    return defer(() => operationalRequestContext.run({
      userId: request.user?.id ?? null,
      isSuperadmin: request.user?.isSuperadmin ?? false,
      overrideRequested: raw === 'true',
      method: request.method,
      path: request.path,
      overrideAudited: false,
    }, () => next.handle()));
  }
}
