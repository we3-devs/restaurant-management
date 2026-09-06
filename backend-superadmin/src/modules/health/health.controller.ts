import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Checks database connectivity and reports process uptime' })
  async check() {
    const db = await this.checkDb();
    return { status: db.status === 'ok' ? 'ok' : 'degraded', db, uptime: process.uptime() };
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
}
