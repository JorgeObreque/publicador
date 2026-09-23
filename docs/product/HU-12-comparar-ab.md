# HU-12 — Comparar versiones A y B

> Como usuaria, quiero comparar dos versiones del anuncio para identificar cuál obtiene mejores resultados.

## Pantalla

Sección de comparación dentro del detalle de una campaña con más de un creativo.

## Criterios de aceptación

- Muestra imagen y nombre de cada versión.
- Compara gasto, clics, citas atribuidas, costo por cita e ingresos.
- No declara un ganador si los datos son insuficientes.
- Cuando una versión tiene mejores resultados, lo presenta como **mejor resultado hasta ahora**, no como ganador definitivo.
- Explica que el resultado puede cambiar al acumular más información.
- La comparación no modifica ni pausa anuncios automáticamente.

## Pendiente de backend

- `GET /api/v1/analytics/experiments/:id` ya devuelve `winner` y `lift` básicos, pero sin validación estadística.
- El MVP debe evitar afirmaciones de ganador estadísticamente confiable.

## MVP no perfecto

- Sin cálculo de significancia estadística.
- Sin sugerencia automática de ganador.
- Sin rotación automática de presupuesto.

## Depende de

- HU-05 para crear la segunda versión.
