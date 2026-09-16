# ADR 0005: Integración con EasyAppointments

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

La conversión real de la peluquería se materializa cuando una clienta abona y la operadora crea una cita en Easy!Appointments.

## Decisión

- La aplicación no reemplaza a Easy!Appointments, la complementa.
- Se importa información mediante REST API autenticada con Basic Auth.
- Cada cita trae un código de atribución colocado por la operadora en las notas.
- La operadora confirma `Abono realizado` y registra el ingreso final dentro de esta aplicación.
- El precio configurado en Easy!Appointments es una estimación inicial.

## Consecuencias

- Atribución por cita individual con trazabilidad hacia campaña y creativo.
- Resultado comercial medible sin duplicar la agenda.
- La rotación de credenciales queda como prerrequisito antes de exponer públicamente.
