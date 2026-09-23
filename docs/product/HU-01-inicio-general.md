# HU-01 — Estado general al ingresar

> Como usuaria, quiero ver las campañas y tareas importantes al ingresar para saber qué necesita atención.

## Pantalla

Pantalla de inicio con resumen ejecutivo y acceso rápido a las campañas y citas.

## Criterios de aceptación

- Muestra el conteo de campañas en cada estado: borrador, publicada y pausada, con error y archivada.
- Muestra la cantidad de citas pendientes de confirmar.
- Muestra el estado de las conexiones con Meta, Google Drive y EasyAppointments sin exponer credenciales.
- Si una integración falla, indica cuál falló y cómo reintentar.
- Ofrece la acción principal **Crear campaña**.
- No muestra inicialmente CTR, CPM, CPL ni otros términos publicitarios avanzados.

## Pendiente de backend

Ninguno. `GET /api/v1/business/overview` puede cubrir este resumen cuando exista.

## MVP no perfecto

- Sin recomendaciones automáticas.
- Sin alertas basadas en historial.
- Sin gráficos de tendencia.

## Depende de

- HU-11, HU-13 para enriquecer el resumen.
