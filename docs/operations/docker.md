# Stack con Docker

Toda la aplicación (PostgreSQL, API NestJS, web Next.js) corre dentro de
Docker Compose. La API aplica las migraciones Prisma en el arranque, así
que `docker compose up` deja el sistema funcional sin pasos manuales.

## Servicios

| Servicio | Imagen base | Puerto host | Notas |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `5432` | Sólo accesible vía la red `publicador-net` desde la API. |
| `api` | `node:22-alpine` | `127.0.0.1:3001` | Espera a Postgres, corre `prisma migrate deploy` y levanta Nest. |
| `web` | `node:22-alpine` | `127.0.0.1:3000` | Next.js 14 con `output: 'standalone'` (ver `apps/web/next.config.mjs`). |

Healthchecks incluidos en los tres servicios (curl-like con `wget` para
alpine, `pg_isready` para Postgres).

## Levantar el stack

```bash
# Construye imágenes y arranca todos los servicios.
docker compose up --build

# Si ya construiste las imágenes antes, basta con:
docker compose up -d
```

`docker compose up` en primer plano es útil para seguir los logs; `-d`
deja los servicios en background.

## Variables de entorno

Las variables se cargan desde `.env` (gitignored) gracias al bloque
`env_file` de cada servicio. El repo trae `.env.example` con la lista
completa. Variables explícitas en `docker-compose.yml` (host de Postgres,
puertos, etc.) tienen prioridad sobre el archivo `.env`.

`DATABASE_URL` se sobreescribe dentro del servicio `api` para apuntar al
contenedor `postgres` (`postgres:5432`) en lugar de `localhost`, porque
dentro de la red de Docker el host no es válido.

## Logs

```bash
# Logs en vivo de todos los servicios.
docker compose logs -f

# Sólo la API.
docker compose logs -f api

# Últimas 50 líneas, sin follow.
docker compose logs --tail=50 api
```

## Reiniciar / reconstruir un servicio

```bash
# Sólo la API (tras un cambio en apps/api/** o en su Dockerfile).
docker compose up -d --build api

# Forzar rebuild desde cero (sin caché de capas).
docker compose build --no-cache api
```

## Resetear la base de datos

> **Borra los datos.** Útil sólo en entornos locales o de prueba.

```bash
docker compose down -v       # -v elimina también el volumen postgres
docker compose up -d --build # recrea todo y aplica migraciones
```

## Entrar a un contenedor

```bash
docker compose exec api sh
docker compose exec web sh
docker compose exec postgres psql -U publicador -d publicador
```

## Correr tests

La pipeline de tests usa un compose aparte para no contaminar la BD de
desarrollo:

```bash
docker compose -f docker-compose.test.yml up -d
pnpm test
docker compose -f docker-compose.test.yml down -v
```

Los scripts del repo (`scripts/run-integration.sh`,
`scripts/run-smoke.sh`) ya levantan y migran la BD de tests por su
cuenta.

## Arquitectura de las imágenes

- `apps/api/Dockerfile`: 3 etapas (`builder`, `deploy`, `runner`). Usa
  `pnpm deploy --filter @publicador/api --prod` para producir un bundle
  sin devDeps ni sin las deps de web. La etapa runner copia el binario
  `prisma` desde el builder (necesario para `migrate deploy`) y fija
  `PRISMA_QUERY_ENGINE_LIBRARY` / `PRISMA_SCHEMA_ENGINE_BINARY` para
  apuntar al motor openssl 3.0.x (alpine 3.21+ trae libssl 3, no 1.1).
- `apps/web/Dockerfile`: 2 etapas (`builder`, `runner`). El builder
  corre `next build` con `output: 'standalone'`. El runner copia sólo
  `.next/standalone`, `.next/static` y `public/`.

## Tareas frecuentes

| Tarea | Comando |
| --- | --- |
| Ver imágenes construidas y su tamaño | `docker image ls \| grep publicador` |
| Validar el YAML del compose | `docker compose config --quiet` |
| Inspeccionar la red interna | `docker network inspect publicador_publicador-net` |
| Backup lógico de la BD | `docker compose exec postgres pg_dump -U publicador publicador > backup.sql` |