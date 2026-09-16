# ADR 0003: Contexto de negocio único sin autenticación

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

El MVP se utiliza solo para una peluquería. No existe aún necesidad real de múltiples negocios ni de múltiples operadores.

## Decisión

- Existe un único `BUSINESS_ID` cargado desde variables de entorno.
- `BusinessContextResolver` resuelve este valor server-side.
- No se implementan autenticación, login, registro, recuperación de contraseñas, roles, permisos ni sesiones.
- Las entidades de dominio se protegen igual con `businessId` para preparar multi-tenant futuro.

## Consecuencias

- Reducción significativa de superficie a construir y mantener.
- Cualquier consulta debe pasar por el resolver y filtrar por `businessId`.
- La introducción futura de autenticación solo reemplazará el resolver.
