import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const redisConfig = configService.get('redis', { infer: true });
        return {
          connection: {
            host: redisConfig?.host,
            port: redisConfig?.port,
            // Capped backoff, retried forever — see redis.module.ts for why
            // this no longer gives up after N attempts.
            retryStrategy: (times: number) => Math.min(times * 200, 2000),
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
