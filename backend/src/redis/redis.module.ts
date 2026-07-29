import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../config/configuration';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const redisConfig = configService.get('redis', { infer: true });
        return new Redis({
          host: redisConfig?.host,
          port: redisConfig?.port,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          // Capped backoff, retried forever — a long-running server should
          // reconnect on its own once Redis comes back. Test/seed processes
          // don't rely on this client ever giving up to exit cleanly; they
          // use --forceExit instead (see backend/package.json test:e2e).
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
