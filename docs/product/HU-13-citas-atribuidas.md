# HU-13 — Revisar citas atribuidas

> Como usuaria, quiero revisar las citas generadas por campañas para conectar publicidad con resultados reales del negocio.

## Pantalla

Sección de citas dentro del detalle de una campaña y listado general de citas pendientes.

## Criterios de aceptación

- Permite sincronizar citas con EasyAppointments desde la aplicación.
- Lista las citas pendientes de confirmar.
- Muestra la campaña y la versión atribuida cuando el código de atribución esté presente.
- Permite confirmar un depósito parcial o total.
- Permite registrar asistencia, cancelación o no llegada.
- Permite registrar el ingreso final.
- Las citas sin atribución siguen siendo visibles.
- Las citas no se atribuyen a ninguna campaña si falta el código.
- Las fechas se muestran en horario de Chile.
- El resultado y el ingreso se reflejan en los indicadores de HU-11.

## Pendiente de backend

Ninguno. `GET /api/v1/easyappointments/pending`, `POST /api/v1/easyappointments/:id/deposit` y `POST /api/v1/easyappointments/:id/outcome` ya están disponibles.

## MVP no perfecto

- Sin recordatorios automáticos para citas próximas.
- Sin conciliación bancaria.
- Sin exportación contable.
