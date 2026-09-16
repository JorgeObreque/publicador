# ADR 0001: Monolito modular NestJS + Next.js

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Durante el MVP la aplicación atenderá únicamente a una peluquería. El objetivo es validar el ciclo de campañas Meta con aprendizaje iterativo. Construir un SaaS multiusuario desde el inicio añadiría complejidad sin valor inmediato.

## Decisión

Adoptar un monolito modular con dos aplicaciones dentro de un monorepo pnpm:

- `apps/api`: NestJS con módulos por dominio (campañas, creativos, Meta Ads, tracking, conversiones, analytics, experimentos, optimización, insights, decision log, EasyAppointments).
- `apps/web`: Next.js para el panel del operador.
- `packages/database`: Prisma schema, migraciones y cliente compartido.

## Alternativas consideradas

- Next.js full-stack con Route Handlers: insuficiente para jobs programados e integraciones de larga duración.
- Microservicios: sobrearquitectura para una sola peluquería.

## Consecuencias

- Separación clara entre frontend y backend.
- Espacio para introducir autenticación y multi-tenant sin reconstruir.
- Migraciones compartidas vía paquete `@publicador/database`.
