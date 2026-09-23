# HU-03 — Elegir una fotografía desde Drive

> Como usuaria, quiero ver y elegir fotografías directamente desde Google Drive sin almacenarlas permanentemente en Publicador.

## Pantalla

Segundo paso del asistente, con una galería de imágenes.

## Criterios de aceptación

- Permite sincronizar Google Drive desde la pantalla si la galería está vacía o desactualizada.
- Muestra una galería con miniatura, nombre, tipo y tamaño.
- Indica claramente si la imagen es HEIC o HEIF y mostrará la nota **Se convertirá al publicar**.
- Permite seleccionar una imagen y guardar solo el `mediaAssetId` del creativo.
- Informa cuando una imagen ya no está disponible en Drive y sugiere elegir otra.
- No muestra rutas internas ni identificadores técnicos del servidor.
- No descarga el archivo completo al seleccionar; solo guarda el identificador.
- La imagen seleccionada se conserva al volver a editar la campaña.

## Pendiente de backend

Ninguno. Los endpoints disponibles son:

- `POST /api/v1/media-assets/drive/sync`
- `GET /api/v1/media-assets`
- `GET /api/v1/media-assets/:id/thumbnail`

## MVP no perfecto

- Sin carpetas, buscador ni filtros.
- Sin previsualización ampliada.
- Sin edición ni recorte.
- Sin videos utilizables todavía.
