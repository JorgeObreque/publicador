# ADR 0010: Zona horaria histórica de la cuenta Meta

- Estado: Aceptado
- Fecha: 2026-09-20

## Contexto

La cuenta publicitaria existente usa `Pacific/Easter`, mientras que Blondor y EasyAppointments operan en `America/Santiago`. Cambiar la zona de la cuenta durante la construcción del MVP agregaría riesgo a campañas activas y a la interpretación de métricas históricas.

## Decisión

- Mantener temporalmente la cuenta Meta en `Pacific/Easter`.
- Interpretar los límites diarios de Insights en la zona configurada por la cuenta.
- Interpretar fechas locales de EasyAppointments en `America/Santiago`.
- Persistir instantes en UTC y días de reporte como fechas civiles canónicas.
- Evaluar una migración de cuenta después de estabilizar publicación, atribución y métricas.

## Consecuencias

- Los cierres diarios de Meta y del negocio pueden diferir.
- La conversión de zona horaria debe ser explícita y estar probada.
- No se modifica la cuenta ni sus campañas activas durante el MVP.
