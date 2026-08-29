import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Final safety net for legacy endpoints that still return entities directly. */
const NEVER_EXPOSE = new Set([
  'password',
  'rememberToken',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'tokenHash',
  'replacedByTokenHash',
  'otpCode',
  'otpHash',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'deletedAt',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!NEVER_EXPOSE.has(key)) output[key] = sanitize(child);
  }
  return output;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => sanitize(value)));
  }
}
