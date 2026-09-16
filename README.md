# Publicador

Plataforma de campañas Meta con aprendizaje iterativo.

## Stack

- Monorepo pnpm.
- `apps/api`: NestJS, PostgreSQL y Prisma.
- `apps/web`: Next.js para el panel del operador.
- `packages/database`: Prisma schema, migraciones y seed.

## Comandos

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev          # API NestJS
pnpm dev:web      # Frontend Next.js
pnpm build
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:smoke
pnpm test:e2e
pnpm test:all
```

## Configuración inicial

1. Copiar `.env.example` a `.env` y completar:
   - `DATABASE_URL`
   - `BUSINESS_ID`
   - Credenciales Meta, OpenAI y EasyAppointments.
2. Levantar PostgreSQL local o apuntar a uno existente.
3. Ejecutar migraciones y seed.
4. Iniciar API y frontend.

## Estructura

```text
apps/
  api/          Backend NestJS
  web/          Frontend Next.js
packages/
  database/     Prisma schema y migraciones
docs/
  adr/          Architectural Decision Records
  operations/   Manuales operativos
prisma/         Migraciones compartidas (referencia)
```

## Convenciones

- Sin autenticación en esta etapa.
- Contexto de negocio único vía `BUSINESS_ID`.
- Toda migración de DDL queda versionada en `packages/database/prisma/migrations`.
- Decisiones arquitectónicas en `docs/adr`.
