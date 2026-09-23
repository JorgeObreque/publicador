# HU-07 — Validaciones comprensibles

> Como usuaria, quiero saber qué falta o qué está mal antes de publicar la campaña.

## Alcance

Capa transversal presente en todos los pasos del asistente y en la pantalla de revisión.

## Criterios de aceptación

- Detecta los siguientes casos antes de habilitar el envío a Meta:

| Caso | Mensaje |
|---|---|
| Servicio u objetivo sin definir | Falta elegir qué quieres promocionar |
| Imagen no seleccionada | Falta elegir una fotografía del negocio |
| Imagen eliminada de Drive | La fotografía seleccionada ya no está disponible |
| Texto principal vacío | Escribe el mensaje principal del anuncio |
| Título vacío | Escribe un título corto |
| Presupuesto inválido o sin definir | Define un presupuesto diario o total |
| Fecha final anterior a la inicial | La fecha de término debe ser posterior a la fecha de inicio |
| Conexión con Meta no disponible | No podemos hablar con Meta ahora mismo |
| Ambas versiones idénticas | Las dos versiones son iguales, no compararemos resultados |

- Cada mensaje indica cómo corregirlo sin exponer detalles técnicos.
- Las validaciones críticas bloquean el envío a Meta.
- Las recomendaciones no críticas permiten continuar con una advertencia visible.
- No muestra mensajes de Prisma, NestJS ni Meta Graph API.

## Pendiente de backend

Ninguno. Las validaciones viven en el frontend y complementan las del backend.

## MVP no perfecto

- Sin recomendaciones automáticas de calidad del anuncio.
