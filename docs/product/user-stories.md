# Historias de usuario

Historias priorizadas para guiar el frontend de Publicador y alinear el backend cuando haga falta.

## Persona

> Administradora o dueña de un negocio como Blondor que necesita crear y revisar campañas de Meta Ads sin conocer la estructura técnica, y sin arriesgar gastar de más.

## Recorrido principal

```text
Elegir qué promocionar
  → elegir fotografía desde Drive
  → escribir el anuncio
  → definir presupuesto
  → revisar
  → enviar pausado a Meta
  → consultar resultados
```

## Entregas

- **Entrega 1 — Crear y publicar:** HU-02, HU-03, HU-04, HU-06, HU-07, HU-08, HU-09, HU-10.
- **Entrega 2 — Medir:** HU-01, HU-11, HU-13.
- **Entrega 3 — Aprender:** HU-05, HU-12, HU-14.

## Índice

| Historia | Archivo | Entrega |
|---|---|---|
| HU-01 — Estado general al ingresar | `HU-01-inicio-general.md` | 2 |
| HU-02 — Elegir qué promocionar | `HU-02-elegir-servicio.md` | 1 |
| HU-03 — Elegir una fotografía desde Drive | `HU-03-galeria-drive.md` | 1 |
| HU-04 — Escribir el anuncio | `HU-04-escribir-anuncio.md` | 1 |
| HU-05 — Crear una segunda versión opcional | `HU-05-segunda-version.md` | 3 |
| HU-06 — Definir presupuesto y duración | `HU-06-presupuesto.md` | 1 |
| HU-07 — Validaciones comprensibles | `HU-07-validaciones.md` | 1 |
| HU-08 — Revisar la campaña | `HU-08-revisar-campana.md` | 1 |
| HU-09 — Enviar la campaña pausada | `HU-09-enviar-pausado.md` | 1 |
| HU-10 — Ver el detalle y estado de una campaña | `HU-10-detalle-campana.md` | 1 |
| HU-11 — Resultados comprensibles | `HU-11-resultados.md` | 2 |
| HU-12 — Comparar versiones A y B | `HU-12-comparar-ab.md` | 3 |
| HU-13 — Revisar citas atribuidas | `HU-13-citas-atribuidas.md` | 2 |
| HU-14 — Registrar decisiones | `HU-14-registrar-decisiones.md` | 3 |

## Convenciones

- Cada historia incluye criterios de aceptación verificables.
- Cada historia menciona explícitamente lo que **no** hace en esta iteración (MVP no perfecto).
- Las dependencias con el backend se marcan con **Pendiente de backend**.
- Las dependencias con otras historias se marcan con **Depende de**.
- El estado se mantiene con este MVP:

```text
Entrega 1 (en construcción)
  → Entrega 2 (siguiente)
  → Entrega 3 (al final)
```

## Cómo usar este directorio

1. Leer el recorrido principal para entender el orden de pantallas.
2. Empezar siempre por las historias de Entrega 1, en el orden del recorrido.
3. Cuando se necesite exponer una API nueva, anotarla en **Pendiente de backend** y mantener el criterio de aceptación como contrato objetivo.
4. Si una historia cambia de alcance, actualizar este README y moverla de entrega si corresponde.
