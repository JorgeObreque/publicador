# ADR 0004: Publicación Meta en estado pausado

- Estado: Aceptado
- Fecha: 2026-09-13

## Contexto

Publicar campañas en Meta mediante API puede generar gasto real desde el primer minuto. Un error humano o de configuración puede provocar gasto no deseado.

## Decisión

- Las campañas creadas mediante Marketing API quedan en estado `PAUSED`.
- La activación es una acción explícita del operador.
- El sistema distingue entre `created`, `approved`, `activated` y `archived`.

## Consecuencias

- Doble confirmación antes de gastar dinero real.
- Permite revisar anuncios antes de gastar.
- Reduce incidentes en producción.
