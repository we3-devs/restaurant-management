import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface QueryMetrics {
  query: string;
  acquireStartUs: number;
  acquireEndUs?: number;
  queryStartUs?: number;
  queryEndUs?: number;
  totalUs?: number;
  acquireMs?: number;
  executeMs?: number;
  totalMs?: number;
}

@Injectable()
export class PoolMetrics implements OnModuleInit {
  private readonly logger = new Logger(PoolMetrics.name);
  private queryStack: Map<string, QueryMetrics> = new Map();

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.instrumentDataSource();
    this.logger.log('PoolMetrics: Database instrumentation active');
  }

  private instrumentDataSource() {
    const originalQuery = this.dataSource.query.bind(this.dataSource);

    this.dataSource.query = async (query: string, parameters?: any[]) => {
      const queryId = `${Date.now()}-${Math.random()}`;
      const acquireStartUs = this.nowMicros();

      const metrics: QueryMetrics = {
        query: query.substring(0, 100),
        acquireStartUs,
      };

      this.queryStack.set(queryId, metrics);

      try {
        // Measure connection acquisition + query execution combined
        metrics.queryStartUs = this.nowMicros();
        const result = await originalQuery(query, parameters);
        metrics.queryEndUs = this.nowMicros();

        // Calculate metrics
        const totalUs = metrics.queryEndUs - metrics.acquireStartUs;
        metrics.totalUs = totalUs;
        metrics.totalMs = Math.round(totalUs / 1000);

        // Log slow queries (>50ms) — excludes the pool warm-up ping (app.module.ts),
        // which is expected to take 100ms+ against a remote DB and isn't an app-level slowdown.
        if (metrics.totalMs > 50 && metrics.query !== 'SELECT 1') {
          this.logger.warn(
            `[PERF:DB] query="${metrics.query}" total=${metrics.totalMs}ms (slow)`
          );
        }

        return result;
      } finally {
        this.queryStack.delete(queryId);
      }
    };
  }

  private nowMicros(): number {
    const [seconds, nanos] = process.hrtime();
    return seconds * 1_000_000 + Math.round(nanos / 1_000);
  }

  getPoolStatus() {
    const pool = (this.dataSource.driver as any)?.postgres?.pool;
    if (!pool) {
      return { note: 'Pool not accessible' };
    }
    return {
      available: pool.availableObjectsCount || 0,
      waiting: pool.waitingClientsCount || 0,
      max: pool.max || 0,
      min: pool.min || 0,
    };
  }

  logPoolStatus(context: string = '') {
    const status = this.getPoolStatus();
    this.logger.log(`[POOL:${context}] ${JSON.stringify(status)}`);
    return status;
  }
}
