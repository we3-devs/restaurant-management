import { Logger } from '@nestjs/common';

interface PerfMetrics {
  [key: string]: { startUs: number; endUs?: number; durationMs?: number };
}

const contextMap = new WeakMap<object, PerfMetrics>();

export function PerfSection(sectionName: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get or create metrics object for this request
      const req = args[0]?.req || args[args.length - 1];
      let metrics: PerfMetrics;

      if (req && !contextMap.has(req)) {
        metrics = {};
        contextMap.set(req, metrics);
      } else if (req) {
        metrics = contextMap.get(req)!;
      } else {
        metrics = {};
      }

      const startUs = process.hrtime.bigint();
      const result = await originalMethod.apply(this, args);
      const endUs = process.hrtime.bigint();
      const durationMs = Math.round(
        Number(endUs - startUs) / 1_000_000,
      );

      metrics[sectionName] = {
        startUs: Number(startUs),
        endUs: Number(endUs),
        durationMs,
      };

      return result;
    };

    return descriptor;
  };
}

export function PerfProfile(endpointName: string, logger: Logger) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      const startUs = process.hrtime.bigint();
      const startMs = Date.now();

      try {
        const result = await originalMethod.apply(this, args);

        const endUs = process.hrtime.bigint();
        const durationMs = Math.round(Number(endUs - startUs) / 1_000_000);

        // Get stored metrics from context
        const metrics = contextMap.get(req);

        if (metrics && Object.keys(metrics).length > 0) {
          const parts = Object.entries(metrics)
            .map(([name, m]) => `${name}=${m.durationMs}ms`)
            .join(' ');
          logger.log(
            `[PERF:${endpointName}] total=${durationMs}ms (${parts})`
          );
        } else {
          logger.log(`[PERF:${endpointName}] total=${durationMs}ms`);
        }

        contextMap.delete(req);
        return result;
      } catch (error) {
        contextMap.delete(req);
        throw error;
      }
    };

    return descriptor;
  };
}
