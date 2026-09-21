# Meta Ads

Variables requeridas:

- `META_API_VERSION`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `META_AD_ACCOUNT_TIMEZONE` (`Pacific/Easter` para la cuenta actual)
- `META_APP_ID`
- `META_APP_SECRET`
- `META_BUSINESS_ID`
- `META_PAGE_ID`
- `META_INSTAGRAM_ACCOUNT_ID`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_NUMBER` (dígitos E.164, sin `+`)

## Flujo de publicación

1. Crear una campaña local con exactamente un presupuesto y asociar al menos un creativo con imagen y CTA `WHATSAPP_MESSAGE`.
2. Ejecutar `POST /api/v1/meta-ads/campaigns/:id/publish-paused`.
3. El preflight valida cuenta activa, negocio, moneda CLP y zona horaria.
4. Se crean campaña, conjunto, creativo y anuncio; campaña, conjunto y anuncio quedan en `PAUSED`.
5. Cada ID se persiste al completar su paso. Repetir la solicitud reutiliza los objetos existentes.
6. El operador revisa toda la jerarquía en Meta Ads Manager.
7. La activación queda fuera de este endpoint y siempre debe ser explícita.

La audiencia inicial del MVP es mujeres de 18 a 65 años en la Región Metropolitana, con Advantage Audience. La publicación usa objetivo `OUTCOME_ENGAGEMENT`, optimización `CONVERSATIONS` y destino `WHATSAPP`.

El destino usa el número E.164 asociado a la página mediante `whatsapp_phone_number`; no registra el teléfono en Cloud API ni requiere permisos de envío de mensajes.

Los fixtures Meta solo están habilitados con `NODE_ENV=test`. Credenciales incompletas en cualquier otro entorno producen un error; nunca se simula una publicación exitosa.

`POST /api/v1/meta-ads/metrics/import` recibe `from` y `to` como días civiles `YYYY-MM-DD` de la cuenta Meta, no como instantes UTC.

## Zonas horarias

- Los días civiles de Insights se consultan en `Pacific/Easter`, que es la configuración de la cuenta publicitaria histórica.
- Las citas de EasyAppointments se interpretan en `America/Santiago` y se persisten como instantes UTC.
- La migración de la cuenta publicitaria se difiere hasta después de estabilizar el MVP.

## Recursos Creativos

- Los creativos viven en `MediaAsset` y admiten origen Google Drive o URL manual.
- `POST /api/v1/media-assets/drive/sync` descubre `imagenes` y `videos` bajo la raíz configurada.
- Archivos HEIC y HEIF de Drive se convierten automáticamente a JPG vía `heif-convert`, se guardan en `PUBLICADOR_MEDIA_DIR` y se exponen en `GET /api/v1/media-assets/:id/file`.
- `GET /api/v1/media-assets/:id/download` devuelve la URL pública utilizable como `imageUrl` en la publicación de Meta; los orígenes permitidos se amplían con `PUBLICADOR_PUBLIC_BASE_URL`.
