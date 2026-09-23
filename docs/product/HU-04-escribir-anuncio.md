# HU-04 — Escribir el anuncio

> Como usuaria, quiero escribir el mensaje del anuncio y ver una vista previa antes de publicarlo.

## Pantalla

Tercer paso del asistente, dedicado al texto y la vista previa.

## Criterios de aceptación

- Solicita texto principal, título, descripción opcional y llamada a la acción.
- Muestra contadores de caracteres para cada campo.
- La llamada a la acción recomendada es **Enviar mensaje**.
- La imagen seleccionada en HU-03 aparece en la vista previa.
- La vista previa muestra cómo se verá el anuncio en una pantalla de WhatsApp, sin pretender replicar Meta Ads Manager.
- El sistema agrega automáticamente el código de atribución; la usuaria nunca lo escribe.
- Explica que el anuncio abrirá WhatsApp con un mensaje prellenado.

## Pendiente de backend

- El DTO actual exige exactamente una fuente: `imageUrl` o `mediaAssetId`. La HU usa siempre `mediaAssetId`.

## MVP no perfecto

- No genera texto con IA.
- No permite guardar borradores parciales sin imagen.
- La vista previa es aproximada.
