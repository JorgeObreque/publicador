# Revisión de implementación

- Fecha: 2026-09-13
- Alcance: monorepo completo (NestJS API, Next.js Web, Prisma, Jest, Playwright, Docker, ADRs).
- Modo: revisión estática. No se instalaron dependencias, no se generaron artefactos y no se modificaron archivos durante la auditoría.

## Resumen

La implementación constituye un scaffold inicial. Todavía no instala, compila, migra ni prueba el MVP de forma confiable. El riesgo más urgente es que las pruebas automáticas podrían borrar accidentalmente una base de datos real.

## Limitaciones de la verificación

- No existe `node_modules` ni `pnpm-lock.yaml`.
- Prisma no está instalado, por lo que no se pudo ejecutar `prisma validate`, `prisma generate` ni `prisma migrate`.
- No se levantaron servicios Docker.
- No se ejecutó integración ni E2E porque el helper de base de datos no aísla la URL y `resetDatabase()` realizaría `deleteMany()` sobre cualquier base apuntada por `DATABASE_URL`.
- `git status` informa “not a git repository”.

## Hallazgos críticos

### 1. Las pruebas pueden borrar una base de datos real

Archivos:
- `apps/api/test/helpers/test-db.ts:4-40`
- `apps/api/test/.env.test:1`
- `.gitignore:8`

`TEST_DATABASE_URL` prioriza el `DATABASE_URL` del proceso. Si un desarrollador o CI exporta una URL de staging o producción, `applyMigrations()` la aplica y `resetDatabase()` ejecuta `deleteMany()` sobre todas las tablas.

Acciones requeridas:
- Fijar la URL de pruebas en el script o en el bootstrap.
- Validar `NODE_ENV === 'test'`, base `publicador_test`, host local o contenedor aprobado.
- Abortar si la validación falla.
- Cargar una configuración de tests versionada antes de importar `@publicador/database`.
- Considerar un esquema o base con nombre único por ejecución.

### 2. `tsconfig.base.json` extiende un archivo inexistente

Archivo: `tsconfig.base.json:2`

El archivo extiende `../../tsconfig.base.json`, lo que resuelve a `/home/jorge/tsconfig.base.json`, que no existe. Consecuencias:
- `tsc --noEmit` falla con `TS5083`.
- `nest build` falla.
- `next build` falla.
- Las configuraciones de Jest y Playwright en TypeScript pueden romperse.

Acción: convertir `tsconfig.base.json` en una configuración independiente y real.

### 3. No existen migraciones Prisma

Archivos:
- Falta `packages/database/prisma/migrations/`.
- `packages/database/package.json:7-13`
- `apps/api/test/helpers/test-db.ts:14-18`
- `docs/adr/0002-postgresql-prisma-ddl-versionado.md`

`prisma migrate deploy` no crea tablas desde `schema.prisma`. En una base vacía no se aplicaría nada y `seedBusiness()` fallaría al no existir la tabla `Business`.

Acciones requeridas:
- Generar la migración inicial y commitearla.
- Validar el SQL resultante, especialmente índices, acciones de borrado, restricciones de dinero e índices únicos parciales.
- Verificar `migrate deploy` contra una base vacía y volver a aplicarlo para confirmar idempotencia.

## Hallazgos altos

### 4. `@publicador/database` no es desplegable

Archivos:
- `packages/database/package.json:5`
- `packages/database/src/index.ts`

El paquete expone TypeScript crudo. `node dist/main.js` no puede requerir `src/index.ts`. Faltan build, `types`, `exports` y la participación real en el pipeline de build.

Acción: compilar a `dist`, exponer `index.js` y `index.d.ts`, agregar scripts `build` y `typecheck`, asegurar el orden de build recursivo.

### 5. Pruebas unitarias con fallos deterministas

- `apps/api/src/shared/meta/meta-graph.client.spec.ts:1`: importa `../meta-graph.client` cuando debería ser `./meta-graph.client`.
- `apps/api/src/shared/business-context/business-context.resolver.spec.ts:1`: mismo error.
- `apps/api/src/shared/attribution/attribution-code.spec.ts:29-33` contra `apps/api/src/shared/attribution/attribution-code.ts:3,19-22`: la regex está anclada, pero el test exige extraer el código desde texto mixto. La expresión y la validación deben separarse.

Tras corregir, `test:unit`, `test:coverage` y `test:all` deberían pasar.

### 6. Helper de integración con import roto

Archivo: `apps/api/test/helpers/test-app.ts:3`

Importa `../src/app.module` pero la profundidad correcta es `../../src/app.module`.

### 7. E2E y smoke con falsos positivos

- `tests/e2e/smoke.spec.ts:4-9`: solicita una ruta relativa al frontend, captura cualquier error y omite la aserción si falla.
- `tests/e2e/campaign-lifecycle.spec.ts:4-12`: solo verifica que aparezca “Publicador” y llama `page.evaluate(() => true)`. No crea campañas, ni creativos, ni publica, ni importa métricas, ni convierte citas, ni compara variantes.

Acción: solicitar la URL explícita de la API, requerir respuesta correcta, validar `Estado: ok` y reescribir el ciclo con adaptadores simulados.

### 8. Playwright no levanta el sistema completo

Archivo: `playwright.config.ts:20-27`

Solo inicia `pnpm dev:web`. Las pruebas esperan la API en el puerto 3001 y no se aprovisiona PostgreSQL con migraciones y datos.

Acción: orquestar API, web, PostgreSQL, migraciones, reset y seed desde Playwright o desde un script E2E dedicado.

### 9. Readiness responde 200 con base caída

Archivos:
- `apps/api/src/modules/health/health.service.ts:14-27`
- `apps/api/src/modules/health/health.controller.ts:13-16`

`HealthService` atrapa el fallo de base y devuelve `degraded`, pero el controlador responde HTTP 200.

Acción: responder HTTP 503 cuando alguna verificación crítica falle y actualizar la prueba para exigir 503 ante `degraded`.

### 10. Orquestación de tests insegura

Archivo: `package.json:14`

`docker compose up -d` retorna antes de que PostgreSQL esté listo. `db:down` no se ejecuta si Jest falla por estar en una cadena con `&&`.

Acciones:
- Usar `docker compose up -d --wait` o un polling explícito.
- Envolver con `trap` o equivalente para garantizar `docker compose down -v`.

### 11. `test:smoke` es un alias de integración

Archivo: `package.json:14-15`

No existe un proyecto Jest dedicado a smoke ni un archivo `*.smoke.int-spec.ts`. La documentación promete algo distinto a la implementación.

Acción: crear un proyecto smoke separado o un patrón de archivos específico.

### 12. Configuración de entorno inconsistente

- `docs/operations/local-setup.md` instruye crear `.env` en la raíz.
- `apps/api/src/app.module.ts:22` carga variables con `@nestjs/config`, pero su dotenv por defecto apunta a `apps/api/.env`.
- `apps/web` carga únicamente `NEXT_PUBLIC_*` en build time.
- `packages/database/prisma/seed.ts` usa `tsx` directo sin dotenv.
- `.env.example:5-6` deja `BUSINESS_ID=` vacío. El seed con nullish coalescing creará un negocio con `id=''` y la API rechazará ese valor.

Acción: unificar la estrategia. Cargar el archivo raíz de forma explícita o mover archivos por paquete y documentar.

## Hallazgos medios

### 13. Integridad referencial débil en Prisma

Archivo: `packages/database/prisma/schema.prisma`

- Las relaciones no son tenant-aware. Una entidad de negocio A puede referenciar recursos de negocio B.
- La unicidad de `AdMetricDaily` no cubre el caso `(campaignId, date)` con `campaignCreativeId` nulo, lo que duplica métricas.
- `TrackingEvent` y `ExternalAppointment` almacenan IDs de campaña y creativo sin claves foráneas.
- `Conversion` y `ExternalAppointment` no están relacionadas, lo que permite múltiples conversiones por cita y datos desincronizados.

### 14. Fixtures sin utilizar

Archivos:
- `tests/fixtures/meta/*.json`
- `tests/fixtures/easyappointments/*.json`
- `tests/fixtures/openai/*.json`

Ningún test ni adaptador los importa. La promesa de mocks deterministas aún no está implementada.

### 15. Módulos sin comportamiento

Vacíos o casi vacíos:
- `apps/api/src/modules/campaigns/campaigns.module.ts`
- `apps/api/src/modules/creatives/creatives.module.ts`
- `apps/api/src/modules/conversions/conversions.module.ts`
- `apps/api/src/modules/easyappointments/easyappointments.module.ts`
- `apps/api/src/modules/experiments/experiments.module.ts`
- `apps/api/src/modules/optimization/optimization.module.ts`
- `apps/api/src/modules/insights/insights.module.ts`
- `apps/api/src/modules/decision-log/decision-log.module.ts`
- `apps/api/src/jobs/jobs.module.ts`

La documentación describe un flujo completo que no existe.

### 16. Tooling incompleto

- Falta `pnpm-lock.yaml`.
- API ejecuta ESLint sin dependencias ni configuración.
- `tests/package.json` está fuera del workspace.
- Prisma Client no se genera automáticamente.
- `packages/database` no participa en build/typecheck.

## Hallazgos bajos

### 17. Aserciones débiles

- `apps/web/src/lib/format.test.ts` no valida moneda ni formato completo.
- `meta-graph.client.spec.ts` solo verifica `adAccountId`.
- `analytics/metrics.spec.ts` no cubre empates, un solo elemento ni valores negativos.

### 18. Diagnóstico Playwright mínimo

Solo Chromium, sin screenshots de fallo, sin JUnit ni HTML, sin `forbidOnly`, sin retries.

## Reclamaciones de documentación que no se cumplen

| Reclamo | Evidencia en contra |
| --- | --- |
| Integración usa PostgreSQL aislado | `DATABASE_URL` ambiente no se valida. |
| Las migraciones se aplican antes de los tests | No existen migraciones. |
| La base se reinicia entre tests | El primer test no resetea y el orden puede fallar por FK. |
| Smoke verifica `/health` | Acepta 200 con `degraded`. |
| E2E ejecuta el ciclo completo | Solo valida texto estático. |
| Meta, OpenAI y EasyAppointments usan fixtures | Ningún fixture se importa. |
| No se cargan credenciales reales | No se purgan ni se bloquean. |
| Cobertura inicial incluye campañas y conversión | No existen pruebas. |

## Comandos verificados

- `docker compose -f docker-compose.test.yml config` válido a nivel sintáctico.
- `pnpm test:unit` falla por ausencia de `node_modules`.

## Orden recomendado de corrección

1. Proteger la base de pruebas contra borrado accidental.
2. Reparar `tsconfig.base.json` y la carga de entorno.
3. Compilar `@publicador/database` y ordenar el build.
4. Crear y commitear la migración inicial.
5. Hacer reproducible instalación, build, lint y typecheck.
6. Corregir imports y regex en las pruebas unitarias.
7. Aislar la base de integración con validación estricta.
8. Implementar smoke real con API, web y PostgreSQL.
9. Implementar adaptadores simulados y un E2E verdadero.
10. Reforzar integridad referencial y restricciones en Prisma.
11. Ajustar ADRs y documentación al alcance efectivamente implementado.
