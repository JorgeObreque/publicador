# HU-02 — Elegir qué promocionar

> Como usuaria, quiero elegir el servicio que voy a promocionar para que la campaña tenga un objetivo claro.

## Pantalla

Primer paso del asistente de creación de campaña.

## Criterios de aceptación

- Permite elegir un servicio del catálogo.
- Permite nombrar la campaña para identificarla internamente.
- Permite elegir un objetivo recomendado explicado en lenguaje de negocio: **Recibir consultas por WhatsApp**.
- Permite agregar notas opcionales para contexto interno.
- Guarda la campaña como borrador al avanzar.
- No muestra objetivos técnicos crudos de Meta.

## Pendiente de backend

- Falta un endpoint para listar servicios (`Service`). Hoy el modelo existe pero no hay endpoint público.
- La audiencia sigue fija: mujeres de 18 a 65 años en Región Metropolitana con Advantage Audience. No hay selector de audiencia en este MVP.

## MVP no perfecto

- Sin segmentación avanzada.
- Sin múltiples objetivos.
- Sin validación contra un catálogo editable de servicios.
