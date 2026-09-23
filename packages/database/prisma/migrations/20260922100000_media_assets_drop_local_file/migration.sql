-- Drop local file and HEIC-derived linkage columns from MediaAsset.
DROP INDEX IF EXISTS "MediaAsset_externalLocalPath_idx";
DROP INDEX IF EXISTS "MediaAsset_businessId_parentExternalFileId_idx";
ALTER TABLE "MediaAsset"
  DROP COLUMN IF EXISTS "externalLocalPath",
  DROP COLUMN IF EXISTS "parentExternalFileId";
