-- AlterTable
-- Añade la columna `nearbyCommunesCutCodes` a `BusinessProfile` para que el
-- operador pueda marcar manualmente hasta 10 comunas vecinas de interés
-- (la UI le ofrece un top 10 calculado por ingreso, pero el humano puede
-- ajustar la selección). Es una columna `String[]` con default `[]` para
-- mantener compatibilidad con perfiles existentes (no rompe los upserts
-- que no envían el campo). El default `[]` significa "sin selección
-- manual" y NO afecta a la lógica de filtrado ni a los prompts.
ALTER TABLE "BusinessProfile" ADD COLUMN "nearbyCommunesCutCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];