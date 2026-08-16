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
    logger: process.env.NODE_ENV !== 'production'
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
    .setDescription('Restaurant Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get('app', { infer: true })!.port;
  await app.listen(port);
}
void bootstrap();
