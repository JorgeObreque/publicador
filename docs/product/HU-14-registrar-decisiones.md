# HU-14 — Registrar decisiones

> Como usuaria, quiero registrar por qué cambié una campaña para aprender de decisiones anteriores.

## Pantalla

Sección de historial y decisiones dentro del detalle de una campaña.

## Criterios de aceptación

- Permite registrar una decisión manualmente con título, justificación e impacto esperado.
- Permite consultar las decisiones previas de una campaña.
- Permite relacionar una decisión con una recomendación aceptada o rechazada cuando exista.
- No permite editar decisiones históricas; solo agregar nuevas.

## Pendiente de backend

- `GET /api/v1/decision-log` y `POST /api/v1/decision-log` ya existen.
- `OptimizationRecommendation` ya permite aceptar o rechazar recomendaciones, pero la generación automática aún no está implementada.

## MVP no perfecto

- Sin generación automática de recomendaciones.
- Sin métricas de impacto real vs. esperado.

## Depende de

- Recomendaciones automáticas (fuera del MVP actual).
