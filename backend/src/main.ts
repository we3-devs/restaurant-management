import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfig } from './config/configuration';
import {
  UPLOADS_ROUTE,
  resolveUploadDir,
} from './modules/uploads/uploads.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger:
      process.env.NODE_ENV !== 'production'
        ? ['debug', 'error', 'log', 'warn', 'verbose']
        : ['error', 'warn'],
  });

  // Without this, NestJS never runs its shutdown lifecycle on SIGTERM/SIGINT,
  // so TypeOrmModule never calls dataSource.destroy() — every restart (dev
  // --watch reload, deploy, manual kill) abandons the pool's connections to
  // the DB instead of closing them, leaking them until the DB's own
  // idle-connection reaper notices. Directly implicated in connection-pool
  // exhaustion observed during profiling. .
  app.enableShutdownHooks();

  const configService = app.get(ConfigService<AppConfig>);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(helmet());
  // Branding files are public and consumed by separate app origins, including
  // browser requests made before authentication. Scope this relaxation to the
  // upload path; all other API responses retain Helmet's same-origin policy.
  app.use('/api/uploads', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use(compression());
  app.enableCors({
    origin: configService.get('app', { infer: true })!.frontendUrls,
    credentials: true,
  });

  // Uploaded branding (logo/favicon). Filenames are UUIDs and never rewritten,
  // so these are safe to cache immutably.
  app.useStaticAssets(resolveUploadDir(configService), {
    prefix: `/${UPLOADS_ROUTE}`,
    immutable: true,
    maxAge: '30d',
    setHeaders: (res) => {
      // helmet() defaults Cross-Origin-Resource-Policy to same-origin, which
      // would stop all three apps — each a different origin from this API —
      // from rendering an uploaded logo or favicon at all. Relaxed here only,
      // for what are public brand images by definition.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RMS API')
    .setDescription(
      [
        'Restaurant Management System REST API.',
        '',
        'Authentication uses httpOnly cookies in the web applications. The Bearer scheme is also exposed for API clients and local testing.',
        '',
        'All monetary amounts are expressed in the outlet currency. Payment totals are derived from the payment ledger; clients must not calculate or submit paidAmount/dueAmount.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Staff access token. Browser clients use the auth cookie instead.',
      },
      'bearer',
    )
    .addTag('auth', 'Authentication and session management')
    .addTag('orders', 'Orders, order items, and order lifecycle')
    .addTag('order-payments', 'Payment ledger entries and refunds')
    .addTag('customer-auth', 'Customer OTP authentication')
    .addTag('customer-portal', 'Authenticated customer portal')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
  });
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ErrorResponse = {
    type: 'object',
    required: ['statusCode', 'message', 'error', 'timestamp', 'path'],
    properties: {
      statusCode: { type: 'integer', example: 409 },
      message: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
        example: 'Conflict',
      },
      error: { type: 'string', example: 'ConflictException' },
      timestamp: { type: 'string', format: 'date-time' },
      path: { type: 'string', example: '/api/orders/8/status' },
    },
  };
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('responses' in operation)
      )
        continue;
      const responses = (operation as { responses: Record<string, unknown> })
        .responses;
      for (const status of ['400', '401', '403', '404', '409', '500']) {
        responses[status] ??= {
          description: 'Error response',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        };
      }
    }
  }
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get('app', { infer: true })!.port;
  await app.listen(port);
}
void bootstrap();
