import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { EXPOSE_RESPONSE_FIELDS } from './expose-response-fields.decorator';

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

function sanitize(value: unknown, exposedFields: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitize(item, exposedFields));
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!NEVER_EXPOSE.has(key) || exposedFields.has(key)) {
      output[key] = sanitize(child, exposedFields);
    }
  }
  return output;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const exposedFields =
      this.reflector.get<Set<string>>(EXPOSE_RESPONSE_FIELDS, context.getHandler()) ??
      new Set<string>();
    return next.handle().pipe(map((value) => sanitize(value, exposedFields)));
  }
}
