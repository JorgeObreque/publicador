# HU-10 — Ver el detalle y estado de una campaña

> Como usuaria, quiero saber qué configuré y cuál es el estado de la campaña.

## Pantalla

Vista de detalle de una campaña desde el listado.

## Criterios de aceptación

- Muestra el estado actual de la campaña explicado:

  - Borrador.
  - Enviando a Meta.
  - Publicada y pausada.
  - Con error de publicación.
  - Archivada.

- Muestra presupuesto, fechas, gasto máximo estimado y creativos asociados.
- Muestra los identificadores Meta como información secundaria.
- Si la campaña está en error, muestra el motivo y un botón para reintentar.
- No permite activar la campaña desde el MVP.

## Pendiente de backend

Ninguno. `GET /api/v1/campaigns/:id` y los endpoints relacionados ya están disponibles.

## MVP no perfecto

- Sin historial de cambios.
- Sin línea de tiempo de auditoría.
