import { execSync } from 'node:child_process';
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://publicador:publicador@127.0.0.1:5434/publicador_test';

  if (!process.env.SKIP_DB_UP) {
    execSync('docker compose -f docker-compose.test.yml up -d postgres-test', { stdio: 'inherit' });
  }

  const parsed = new URL(databaseUrl);
  const port = Number(parsed.port || 5434);
  const host = parsed.hostname || '127.0.0.1';

  const client = new Client({
    host,
    port,
    user: parsed.username || 'publicador',
    password: parsed.password || 'publicador',
    database: (parsed.pathname || '/publicador_test').replace(/^\//, ''),
  });

  const deadline = Date.now() + 60_000;
  let connected = false;
  while (Date.now() < deadline) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      connected = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await client.end().catch(() => undefined);
  if (!connected) {
    throw new Error(`No se pudo conectar a PostgreSQL en ${host}:${port} tras 60s.`);
  }

  execSync(
    `pnpm --filter @publicador/database exec prisma migrate deploy --schema=packages/database/prisma/schema.prisma`,
    {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );

  execSync(
    `pnpm --filter @publicador/database exec tsx prisma/seed.ts`,
    {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl, BUSINESS_ID: 'test-business' },
    },
  );
}
