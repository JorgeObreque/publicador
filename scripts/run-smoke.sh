#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  docker compose -p publicador-test -f docker-compose.test.yml down -v || true
}
trap cleanup EXIT

docker compose -p publicador-test -f docker-compose.test.yml up -d --wait
DATABASE_URL='postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public' \
NODE_ENV=test \
BUSINESS_ID=test-business \
API_PREFIX=api/v1 \
pnpm --filter @publicador/database exec prisma migrate deploy

DATABASE_URL='postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public' \
NODE_ENV=test \
BUSINESS_ID=test-business \
API_PREFIX=api/v1 \
pnpm --filter @publicador/api exec jest --config jest.config.ts --selectProjects integration --runInBand --testPathPattern smoke
