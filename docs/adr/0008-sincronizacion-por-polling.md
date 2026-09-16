# ADR 0008: Sincronización por polling

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Easy!Appointments admite webhooks, pero requieren configuración adicional en el servidor y aumentan la superficie de fallo durante el MVP.

## Decisión

- Sincronización por polling mediante `@nestjs/schedule`.
- Ventana móvil configurable con `SYNC_LOOKBACK_HOURS`.
- Idempotencia mediante claves naturales en Prisma.
- Webhooks quedan como evolución futura.

## Consecuencias

- Implementación más simple y robusta para validar el MVP.
- Latencia máxima igual al intervalo del cron.
- Sin requisitos especiales de red ni configuración del servidor externo.
