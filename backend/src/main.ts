import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

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
