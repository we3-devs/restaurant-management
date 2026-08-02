import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const redis = configService.get('redis', { infer: true })!;

        return {
          connection: redis.url
            ? {
                url: redis.url,
                retryStrategy: (times: number) => Math.min(times * 200, 2000),
              }
            : {
                host: redis.host,
                port: redis.port,
                retryStrategy: (times: number) => Math.min(times * 200, 2000),
              },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
