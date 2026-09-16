# Entorno local

Requisitos:

- Node.js 20 o superior.
- pnpm 9.
- PostgreSQL 14 o superior.

Pasos:

1. Copiar `.env.example` a `.env` y completar variables.
2. Instalar dependencias: `pnpm install`.
3. Compilar el paquete `@publicador/database`: `pnpm --filter @publicador/database run build`.
4. Aplicar migraciones: `pnpm db:migrate`.
5. Sembrar datos iniciales: `pnpm db:seed`.
6. Levantar API: `pnpm dev`.
7. Levantar frontend: `pnpm dev:web`.

Notas:

- La variable `BUSINESS_ID` debe coincidir con el id sembrado.
- Las credenciales sensibles nunca deben commitearse.
- El bootstrap carga el archivo `.env` desde la raíz del repositorio.
