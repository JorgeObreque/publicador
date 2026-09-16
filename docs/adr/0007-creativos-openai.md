# ADR 0007: Creativos asistidos por OpenAI

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Generar variantes creativas manualmente para cada experimento es lento y limita la experimentación.

## Decisión

- OpenAI como proveedor para copy e imágenes.
- El sistema genera propuestas que el operador puede revisar y editar.
- Toda propuesta queda registrada con `isAiGenerated=true`.
- La versión final enviada a Meta es la editada por el operador.

## Consecuencias

- Más variantes por experimento con bajo esfuerzo.
- Control humano sobre el contenido publicado.
- Dependencia operativa de la API de OpenAI.
