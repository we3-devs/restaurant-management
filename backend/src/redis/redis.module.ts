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

        const redis = redisConfig?.url
          ? new Redis(redisConfig.url, {
              lazyConnect: false,
              maxRetriesPerRequest: 3,
              retryStrategy: (times) => Math.min(times * 200, 2000),
            })
          : new Redis({
              host: redisConfig?.host,
              port: redisConfig?.port,
              lazyConnect: false,
              maxRetriesPerRequest: 3,
              retryStrategy: (times) => Math.min(times * 200, 2000),
            });

        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
