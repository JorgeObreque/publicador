# ADR 0006: Modelo de conversión y atribución

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

El sistema necesita conectar cada conversión comercial con la campaña y creativo que la originó.

## Decisión

- Cada `CampaignCreative` posee un `attributionCode` único.
- El código se incluye en el anuncio y en el primer mensaje de WhatsApp.
- La operadora lo pega en las notas de la cita en Easy!Appointments.
- El sistema busca el código en cada cita importada para asociar la conversión.
- El estado de la conversión evoluciona: `pending`, `deposit_confirmed`, `attended`, `cancelled`, `no_show`.
- El ingreso final se registra explícitamente.

## Consecuencias

- Atribución trazable por cita y por variante creativa.
- Permite calcular CPL, tasa de asistencia y ROAS real.
- Mantiene el flujo operativo actual sin cambiar Easy!Appointments.
