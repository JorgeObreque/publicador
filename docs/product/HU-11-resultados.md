# HU-11 — Resultados comprensibles

> Como usuaria, quiero entender si la campaña está generando resultados para el negocio.

## Pantalla

Sección de resultados dentro del detalle de una campaña.

## Criterios de aceptación

- Muestra los siguientes indicadores en lenguaje de negocio:

  - Dinero gastado.
  - Personas que hicieron clic.
  - Citas atribuidas.
  - Ingresos atribuidos.
  - Costo promedio por cita.
  - Retorno obtenido.

- Ejemplo de presentación:

```text
Gastaste                         $35.000
Personas hicieron clic           18
Citas atribuidas                  4
Costo promedio por cita          $8.750
Ingresos registrados             $120.000
```

- Cada indicador incluye una explicación breve.
- Si no hay datos, muestra **Aún no hay resultados**.
- Muestra el período analizado.
- Permite actualizar los datos desde Meta con `POST /api/v1/meta-ads/metrics/import`.
- No muestra porcentajes aislados sin contexto.
- Los montos se muestran en pesos chilenos.
- Las citas se cuentan a partir del código de atribución detectado en EasyAppointments.

## Pendiente de backend

Ninguno. `GET /api/v1/analytics/campaigns/:id` ya entrega la información necesaria.

## MVP no perfecto

- Sin gráficos avanzados.
- Sin desglose demográfico ni por dispositivo.
- Sin comparación con campañas anteriores.
- Sin recomendaciones automáticas sobre presupuesto o pausa.
