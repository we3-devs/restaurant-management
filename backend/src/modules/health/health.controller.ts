import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Public } from '../auth/decorators/public.decorator';

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Checks DB and Redis connectivity independently' })
  async check() {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status =
      db.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';
    return { status, db, redis };
  }

  private async checkDb(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }
}
