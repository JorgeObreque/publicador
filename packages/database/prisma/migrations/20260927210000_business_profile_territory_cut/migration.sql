-- AlterTable
-- Migra BusinessProfile de campos territoriales libres (city/region/country)
-- a códigos oficiales SUBDERE 2018 (regionCutCode/communeCutCode/countryCode).
-- El orden es importante: primero añadimos columnas, migramos los datos
-- existentes (que aún dependen de city/region), y sólo al final eliminamos
-- los campos antiguos.
ALTER TABLE "BusinessProfile" ADD COLUMN "regionCutCode" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "communeCutCode" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "countryCode" TEXT;

-- Data migration: Blondor queda anclado a la Región Metropolitana (cut 13)
-- y a la comuna de Las Condes (cut 13114). Se preserva countryCode='CL'.
-- Si la base de datos del test está vacía, no hay filas que actualizar y el
-- UPDATE opera sobre 0 filas (idempotente y seguro).
UPDATE "BusinessProfile"
SET "regionCutCode" = '13',
    "communeCutCode" = '13114',
    "countryCode" = 'CL'
WHERE "city" = 'Santiago'
  AND "region" IN ('RM', 'Región Metropolitana');

ALTER TABLE "BusinessProfile" DROP COLUMN "city";
ALTER TABLE "BusinessProfile" DROP COLUMN "region";
ALTER TABLE "BusinessProfile" DROP COLUMN "country";
