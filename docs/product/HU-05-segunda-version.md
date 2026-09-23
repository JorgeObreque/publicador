# HU-05 — Crear una segunda versión opcional

> Como usuaria, quiero preparar una segunda versión del anuncio para descubrir qué imagen o mensaje consigue mejores resultados.

## Pantalla

Paso opcional dentro del asistente de creación.

## Criterios de aceptación

- Permite continuar con un solo anuncio.
- Permite duplicar el anuncio actual y editar al menos la imagen, el texto o el título.
- Identifica las versiones como **Versión A** y **Versión B**.
- Recomienda cambiar solo un elemento a la vez para saber qué influyó en el resultado.
- Advierte si ambas versiones son idénticas.
- No asigna tráfico 50/50 automáticamente; depende de la configuración de la campaña en Meta.

## Pendiente de backend

Ninguno. Se reutiliza el endpoint `POST /api/v1/creatives` con distintos creativos.

## MVP no perfecto

- Sin distribución automática exacta 50/50.
- Sin detección estadística confiable de ganador.

## Depende de

- HU-12 para presentar la comparación.
