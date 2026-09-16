# ADR 0009: Estrategia de testing

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Para validar el MVP y futuros cambios sin recurrir a servicios reales se necesitan pruebas unitarias, de integración, smoke y end-to-end deterministas.

## Decisión

- **Jest** como framework principal para unitarias e integración.
- **Playwright** para smoke y E2E ejecutados contra el frontend y la API.
- **PostgreSQL de pruebas** en Docker Compose (`docker-compose.test.yml`) con base separada (`publicador_test`) en `127.0.0.1:5434`.
- Migraciones reales ejecutadas antes de cada suite de integración.
- Adaptadores fixture para Meta y EasyAppointments. Se activan automáticamente cuando `NODE_ENV === 'test'`.
- Cobertura inicial centrada en el vertical de campañas: atribución, conversión, métricas y publicación pausada.
- CI queda fuera de esta etapa; los comandos son reproducibles localmente mediante scripts (`scripts/run-integration.sh`).
- `tests/test:db:up` y `tests/test:db:down` controlan el contenedor de pruebas; el script de integración lo levanta, espera el healthcheck, aplica migraciones y limpia al salir.

## Consecuencias

- Determinismo en las pruebas automáticas.
- Posibilidad de añadir nuevas suites sin servicios externos.
- Latencia corta y sin costo por uso de APIs reales.
- Las pruebas no tocan bases reales: el helper exige `NODE_ENV=test`, host válido, puerto 5434 y base `publicador_test`.
