import { execSync } from 'node:child_process';
import { prisma } from '@publicador/database';
import { TEST_DATABASE, requireTestDatabaseUrl } from './test-env';

export function ensureTestEnvironment() {
  process.env.NODE_ENV = 'test';
  const validated = requireTestDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = validated.url;
  }
  if (!process.env.BUSINESS_ID) {
    process.env.BUSINESS_ID = 'test-business';
  }
  return validated;
}

export function applyMigrations() {
  execSync('pnpm --filter @publicador/database prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? TEST_DATABASE.url },
  });
}

export async function resetDatabase() {
  const validated = ensureTestEnvironment();
  void validated;
  await prisma.$transaction([
    prisma.optimizationRecommendation.deleteMany(),
    prisma.decisionLogEntry.deleteMany(),
    prisma.insight.deleteMany(),
    prisma.experimentVariant.deleteMany(),
    prisma.experiment.deleteMany(),
    prisma.externalAppointment.deleteMany(),
    prisma.easyAppointmentsServiceMap.deleteMany(),
    prisma.conversion.deleteMany(),
    prisma.trackingEvent.deleteMany(),
    prisma.adMetricDaily.deleteMany(),
    prisma.metaEntityMapping.deleteMany(),
    prisma.metaAdAccount.deleteMany(),
    prisma.campaignCreative.deleteMany(),
    prisma.creative.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.service.deleteMany(),
    prisma.business.deleteMany(),
  ]);
}

export async function seedBusiness(id = 'test-business') {
  return prisma.business.upsert({
    where: { id },
    update: {},
    create: { id, name: 'Test Business', location: 'CL' },
  });
}
