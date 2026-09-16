import { Injectable } from '@nestjs/common';
import { prisma } from '@publicador/database';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  checks: Record<string, { status: 'ok' | 'fail'; latencyMs?: number; error?: string }>;
}

@Injectable()
export class HealthService {
  async check(): Promise<ReadinessReport> {
    const checks: ReadinessReport['checks'] = {};
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      checks.database = { status: 'fail', error: (err as Error).message };
    }

    const status: ReadinessReport['status'] = Object.values(checks).every(
      (c) => c.status === 'ok',
    )
      ? 'ok'
      : 'degraded';

    return { status, checks };
  }
}
