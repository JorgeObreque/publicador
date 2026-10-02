# syntax=docker/dockerfile:1.7

# ---------- builder ----------
# Instala TODAS las deps (dev + prod), genera cliente Prisma y compila
# @publicador/database + apps/api. Etapa auxiliar para producir artefactos.
FROM node:22-alpine AS builder
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/nest-cli.json apps/api/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/next-env.d.ts apps/web/
COPY packages/database/package.json packages/database/tsconfig.json packages/database/
COPY packages/database/prisma packages/database/prisma
COPY packages/database/src packages/database/src
COPY apps/api/src apps/api/src

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Forzamos a Prisma a descargar la variante `linux-musl-openssl-3.0.x` del
# schema-engine. La detección por defecto en Alpine 3.21+ apunta a
# `linux-musl` (que enlaza contra openssl 1.1 y falla en runtime porque el
# sistema trae libssl 3). El binario queda en /app/node_modules/.pnpm/
# @prisma+engines@5.22.0/.../@prisma/engines y el entrypoint lo invoca
# vía PRISMA_SCHEMA_ENGINE_BINARY / PRISMA_QUERY_ENGINE_BINARY.
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

RUN pnpm --filter @publicador/database exec prisma generate
RUN pnpm --filter @publicador/database run build
RUN pnpm --filter @publicador/api run build


# ---------- deploy ----------
# `pnpm deploy --prod` extrae un bundle auto-contenido del workspace
# @publicador/api, sin las devDeps y sin las deps de web. Lo hace en
# /out/api.
FROM node:22-alpine AS deploy
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Necesitamos la estructura completa del workspace para que pnpm deploy
# resuelva @publicador/database y el resto de workspaces.
COPY --from=builder /app /app

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm deploy --filter @publicador/api --prod /out/api --ignore-scripts


# ---------- runner ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    API_PORT=3001 \
    API_PREFIX=api/v1 \
    POSTGRES_HOST=postgres \
    POSTGRES_PORT=5432
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    # `wget` para el healthcheck y `nc` (busybox-extras) para el wait-for-postgres.
    && apk add --no-cache busybox-extras wget \
    && addgroup -S nodejs && adduser -S nodejs -G nodejs

WORKDIR /app

# Bundle auto-contenido de la API (deps prod aplanadas, sin devDeps, sin
# deps de web).
COPY --from=deploy --chown=nodejs:nodejs /out/api /app

# Compilados que no vinieron con el deploy (dist de la API y de la DB).
# El `pnpm deploy` ya trae `dist/` en la raíz (viene de apps/api/dist/).
# Sólo copiamos dist/ del paquete @publicador/database.
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/dist /app/packages/database/dist

# Migraciones Prisma (las ejecuta el entrypoint antes de arrancar la API).
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/prisma /app/packages/database/prisma

# Prisma CLI + engine binaries (necesarios para `prisma migrate deploy`).
# `prisma` es devDep de @publicador/database y por tanto no se incluye en
# el bundle prod que produce el `pnpm deploy --prod`. Lo copiamos desde
# el builder para que el entrypoint pueda ejecutar la migración.
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/prisma@5.22.0 /app/node_modules/.pnpm/prisma@5.22.0
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+engines@5.22.0 /app/node_modules/.pnpm/@prisma+engines@5.22.0
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+debug@5.22.0 /app/node_modules/.pnpm/@prisma+debug@5.22.0
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+fetch-engine@5.22.0 /app/node_modules/.pnpm/@prisma+fetch-engine@5.22.0
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+get-platform@5.22.0 /app/node_modules/.pnpm/@prisma+get-platform@5.22.0
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+engines-version@5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2 /app/node_modules/.pnpm/@prisma+engines-version@5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2

# Cliente Prisma generado (`prisma generate` output). El deploy copia
# @prisma/client pero no el subdirectorio .prisma/client que el runtime
# necesita para resolver imports tipo `.prisma/client/default`.
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma

# Script de arranque.
COPY --chown=nodejs:nodejs apps/api/entrypoint.sh /app/apps/api/entrypoint.sh

USER nodejs
WORKDIR /app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://localhost:3001/api/v1/health/ready || exit 1

ENTRYPOINT ["sh", "/app/apps/api/entrypoint.sh"]