# HU-06 — Definir presupuesto y duración

> Como usuaria, quiero indicar cuánto puedo invertir y entender el gasto máximo estimado.

## Pantalla

Cuarto paso del asistente, dedicado al presupuesto y las fechas.

## Criterios de aceptación

- Permite elegir entre presupuesto diario o presupuesto total.
- Permite indicar fecha de inicio y fecha de término.
- Muestra el gasto máximo estimado en pesos chilenos.
- No permite fechas inválidas ni presupuestos negativos.
- No permite definir ambos tipos de presupuesto simultáneamente.
- Explica que el presupuesto es un máximo estimado y no garantiza una cantidad específica de reservas.

## Ejemplo

```text
Presupuesto diario        $5.000
Duración                   7 días
Gasto máximo estimado      $35.000
```

## Pendiente de backend

Ninguno. El DTO `createCampaignSchema` ya valida presupuesto único y fechas coherentes.

## MVP no perfecto

- No recomienda automáticamente cuánto invertir.
- No compara contra el presupuesto histórico del negocio.
