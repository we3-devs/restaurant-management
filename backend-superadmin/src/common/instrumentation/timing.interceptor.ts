import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { of, throwError } from 'rxjs';

interface TimingInfo {
  requestId: string;
  method: string;
  path: string;
  startTimeUs: number;
  statusCode?: number;
  durationMs?: number;
}

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const requestId = uuidv4().substring(0, 8);
    const [seconds, nanos] = process.hrtime();
    const startTimeUs = seconds * 1_000_000 + Math.round(nanos / 1_000);

    const timing: TimingInfo = {
      requestId,
      method: request.method,
      path: request.path,
      startTimeUs,
    };

    request['requestId'] = requestId;
    request['timing'] = timing;

    return next.handle().pipe(
      tap((data) => {
        const [endSeconds, endNanos] = process.hrtime();
        const endTimeUs = endSeconds * 1_000_000 + Math.round(endNanos / 1_000);
        const durationUs = endTimeUs - startTimeUs;
        const durationMs = Math.round(durationUs / 1_000);

        timing.statusCode = response.statusCode;
        timing.durationMs = durationMs;

        // Log all requests that take >100ms
        if (durationMs > 100) {
          this.logger.warn(
            `[REQ:${timing.requestId}] ${timing.method} ${timing.path} - ${durationMs}ms (status: ${response.statusCode})`
          );
        }

        return data;
      }),
      catchError((error) => {
        const [endSeconds, endNanos] = process.hrtime();
        const endTimeUs = endSeconds * 1_000_000 + Math.round(endNanos / 1_000);
        const durationUs = endTimeUs - startTimeUs;
        const durationMs = Math.round(durationUs / 1_000);

        this.logger.error(
          `[REQ:${timing.requestId}] ${timing.method} ${timing.path} - ERROR after ${durationMs}ms`
        );
        return throwError(() => error);
      }),
    );
  }
}
