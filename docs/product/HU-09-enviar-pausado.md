# HU-09 — Enviar la campaña pausada

> Como usuaria, quiero crear la campaña en Meta sin que comience a gastar automáticamente.

## Pantalla

Pantalla de progreso tras confirmar la revisión.

## Criterios de aceptación

- Muestra un indicador de progreso durante el envío a Meta.
- Crea campaña, conjunto, creativos y anuncios; todos quedan en estado `PAUSED`.
- Si el envío falla, informa qué ocurrió y permite reintentar sin duplicar objetos.
- Al terminar muestra un mensaje claro:

  > La campaña fue creada en Meta y permanece pausada. Todavía no está generando gastos.

- No muestra credenciales ni detalles técnicos del Graph API.
- Muestra los identificadores Meta como información secundaria, no principal.
- No permite activar la campaña desde el MVP.

## Pendiente de backend

Ninguno. `POST /api/v1/meta-ads/campaigns/:id/publish-paused` es idempotente y mantiene los objetos en `PAUSED`.

## MVP no perfecto

- La solicitud es síncrona con un indicador general, sin progreso detallado por cada objeto de Meta.
- No hay cancelación manual una vez iniciado el envío.
