const REQUIRED_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres-test']);
const REQUIRED_PORT = 5434;
const REQUIRED_DB = 'publicador_test';

export interface ValidatedDatabaseConfig {
  url: string;
  host: string;
  port: number;
  database: string;
}

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeTestDatabaseError';
  }
}

export function requireTestDatabaseUrl(): ValidatedDatabaseConfig {
  if (process.env.NODE_ENV !== 'test') {
    throw new UnsafeTestDatabaseError(
      `La base de pruebas solo puede iniciarse con NODE_ENV=test (actual: ${process.env.NODE_ENV ?? 'undefined'}).`,
    );
  }

  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    throw new UnsafeTestDatabaseError('DATABASE_URL no definido en entorno de pruebas.');
  }

  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = Number(parsed.port || (parsed.protocol === 'postgres:' ? 5432 : 5433));
  const database = parsed.pathname.replace(/^\//, '');

  if (!REQUIRED_HOSTS.has(host)) {
    throw new UnsafeTestDatabaseError(
      `Host de base no permitido para pruebas: ${host}. Permitidos: ${Array.from(REQUIRED_HOSTS).join(', ')}.`,
    );
  }
  if (port !== REQUIRED_PORT) {
    throw new UnsafeTestDatabaseError(`Puerto de pruebas inválido: ${port}. Esperado: ${REQUIRED_PORT}.`);
  }
  if (database !== REQUIRED_DB) {
    throw new UnsafeTestDatabaseError(`Base de pruebas inválida: ${database}. Esperada: ${REQUIRED_DB}.`);
  }

  return { url, host, port, database };
}

export const TEST_DATABASE = {
  url: 'postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public',
  host: '127.0.0.1',
  port: REQUIRED_PORT,
  database: REQUIRED_DB,
} as const;
