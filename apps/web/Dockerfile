# syntax=docker/dockerfile:1.7

# ---------- builder ----------
# Compila la web con `output: 'standalone'` (ver apps/web/next.config.mjs)
# para generar `.next/standalone/apps/web/server.js` con un servidor Node
# autónomo y un node_modules mínimo (next + react).
FROM node:22-alpine AS builder
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Manifiestos y configuración base del workspace.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/next-env.d.ts apps/web/
COPY packages/database/package.json packages/database/tsconfig.json packages/database/

# Fuentes necesarias para el typecheck/build de Next.
COPY packages/database/prisma packages/database/prisma
COPY packages/database/src packages/database/src
COPY apps/web/src apps/web/src

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Build de Next. Genera .next/standalone/apps/web/server.js,
# .next/static y .next/standalone/apps/web/.next.
RUN pnpm --filter @publicador/web run build


# ---------- runner ----------
# Imagen final: copia sólo lo que necesita el servidor standalone de Next.
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate \
    && apk add --no-cache wget \
    && addgroup -S nodejs && adduser -S nodejs -G nodejs

WORKDIR /app

# Standalone trae su propio package.json + node_modules reducido (next, react)
# y el server.js en apps/web/server.js (mismo layout que el monorepo).
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
# Assets estáticos servidos por Next.
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nodejs
WORKDIR /app/apps/web

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://localhost:3000/ || exit 1

CMD ["node", "server.js"]