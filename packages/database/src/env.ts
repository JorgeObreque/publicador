import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LoadedEnv {
  path: string | null;
}

const PARSED_CACHE = new Map<string, Record<string, string>>();

function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const exportPrefix = line.startsWith('export ');
    const clean = exportPrefix ? line.slice('export '.length) : line;
    const eqIdx = clean.indexOf('=');
    if (eqIdx === -1) continue;
    const key = clean.slice(0, eqIdx).trim();
    let value = clean.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function loadEnvFile(filePath: string): Record<string, string> {
  const cached = PARSED_CACHE.get(filePath);
  if (cached) return cached;
  if (!existsSync(filePath)) {
    PARSED_CACHE.set(filePath, {});
    return {};
  }
  const parsed = parseDotenv(readFileSync(filePath, 'utf8'));
  PARSED_CACHE.set(filePath, parsed);
  return parsed;
}

export function loadRootEnv(): LoadedEnv {
  const candidates = [
    process.env.PUBLICADOR_ENV_FILE,
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const parsed = loadEnvFile(candidate);
    if (Object.keys(parsed).length > 0) {
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
      return { path: candidate };
    }
  }

  return { path: null };
}
