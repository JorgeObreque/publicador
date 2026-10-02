#!/bin/sh
# Espera activa a Postgres antes de correr migraciones y arrancar la API.
# Asume WORKDIR=/app (raíz del bundle que produce `pnpm deploy`).
set -eu

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
MAX_ATTEMPTS="${POSTGRES_WAIT_ATTEMPTS:-30}"
SLEEP_SECONDS="${POSTGRES_WAIT_SLEEP:-2}"

# Forzamos a Prisma a usar las versiones openssl 3.0.x porque la default
# (linux-musl, openssl 1.1) no enlaza contra la libssl 3.0 que tiene la base
# de node:22-alpine 3.21+.
PRISMA_OPENSSL3_QUERY="/app/node_modules/.pnpm/@prisma+engines@5.22.0/node_modules/@prisma/engines/libquery_engine-linux-musl-openssl-3.0.x.so.node"
PRISMA_OPENSSL3_SCHEMA="/app/node_modules/.pnpm/@prisma+engines@5.22.0/node_modules/@prisma/engines/schema-engine-linux-musl-openssl-3.0.x"
export PRISMA_QUERY_ENGINE_LIBRARY="$PRISMA_OPENSSL3_QUERY"
export PRISMA_QUERY_ENGINE_BINARY="$PRISMA_OPENSSL3_QUERY"
export PRISMA_SCHEMA_ENGINE_BINARY="$PRISMA_OPENSSL3_SCHEMA"

echo "[entrypoint] Esperando a Postgres en ${DB_HOST}:${DB_PORT} (${MAX_ATTEMPTS} intentos)…"

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  if nc -z "$DB_HOST" "$DB_PORT"; then
    echo "[entrypoint] Postgres alcanzable en ${DB_HOST}:${DB_PORT}."
    break
  fi
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
  echo "[entrypoint] No se pudo conectar a Postgres tras ${MAX_ATTEMPTS} intentos." >&2
  exit 1
fi

echo "[entrypoint] Ejecutando prisma migrate deploy…"
# Invocamos el CLI de Prisma directamente (la imagen no expone `prisma` en
# PATH porque es devDep de @publicador/database y quedó fuera del bundle
# que produce `pnpm deploy --prod`).
node node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js \
  migrate deploy \
  --schema=packages/database/prisma/schema.prisma

echo "[entrypoint] Iniciando API…"
exec node dist/main.js