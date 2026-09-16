# Testing

## Tipos

- **Unitarias** (`pnpm test:unit`): utilidades, parsers, métricas, resolvers.
- **Integración** (`pnpm test:integration`): levantan NestJS + PostgreSQL aislado y ejecutan el ciclo completo.
- **Smoke** (`pnpm test:smoke`): alias de integración que valida arranque, `/health/ready` y módulos principales.
- **E2E** (`pnpm test:e2e`): Playwright con API, web y base de pruebas orquestados.
- **Cobertura** (`pnpm test:coverage`): informe de Jest para la API.

## Entorno

- PostgreSQL aislado en `docker-compose.test.yml` (`publicador_test`, puerto 5434, host 127.0.0.1).
- `scripts/run-integration.sh` levanta el contenedor, espera healthcheck, aplica migraciones, ejecuta Jest y limpia.
- Reset entre tests para garantizar aislamiento.

## Servicios externos

- Meta y EasyAppointments se simulan con adaptadores fixture cargados desde los tests de integración.
- Ninguna credencial real se carga en pruebas.
- `NODE_ENV === 'test'` activa los adaptadores fixture.

## Flujo de pruebas

```bash
pnpm test:db:up
pnpm test:unit
pnpm test:integration
pnpm test:smoke
pnpm test:e2e
pnpm test:db:down
```

## Añadir nuevos tests

- API unit: `apps/api/src/**/*.spec.ts`.
- API integración: `apps/api/test/**/*.int-spec.ts`.
- Web unit: `apps/web/src/**/*.test.ts(x)`.
- E2E: `tests/e2e/**/*.spec.ts`.
