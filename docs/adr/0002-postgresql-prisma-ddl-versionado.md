# ADR 0002: PostgreSQL + Prisma con DDL versionado

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Toda la persistencia se realiza en PostgreSQL. El DDL debe ser reproducible entre entornos y debe quedar registrado para auditoría y migraciones futuras.

## Decisión

- Prisma como ORM y cliente tipado.
- Cada cambio estructural se versiona como migración en `packages/database/prisma/migrations`.
- No se utiliza `prisma db push` en entornos compartidos o productivos.
- Datos iniciales viven en `packages/database/prisma/seed.ts`, separados del DDL.

## Consecuencias

- Reproducibilidad entre local, staging y producción.
- Auditoría completa de cambios estructurales.
- Los seeds son idempotentes y no alteran el DDL.
