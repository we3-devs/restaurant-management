import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request['requestId'] as string | undefined;

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    let message =
      isHttpException &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
        ? ((exceptionResponse as Record<string, unknown>).message ??
          exception.message)
        : isHttpException
          ? exception.message
          : exception instanceof Error
            ? exception.message
            : String(exception);

    const logMessage = `${request.method} ${request.url} → ${statusCode} | ${message}`;

    if (statusCode >= 500) {
      const errorDetails = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(logMessage, errorDetails);
    } else if (statusCode >= 400) {
      this.logger.warn(logMessage);
    }

    const isDev = process.env.NODE_ENV !== 'production';
    response.status(statusCode).json({
      statusCode,
      ...(requestId ? { requestId } : {}),
      message: isDev ? message : (statusCode >= 500 ? 'Internal server error' : message),
      error: isHttpException ? exception.name : 'InternalServerError',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
