-- Add parent linkage and local path columns for derived media assets (HEIC -> JPG conversion).
ALTER TABLE "MediaAsset"
ADD COLUMN "parentExternalFileId" TEXT,
ADD COLUMN "externalLocalPath" TEXT;

-- Helpful indexes to find derived variants or look up the local file for a raw source.
CREATE INDEX "MediaAsset_businessId_parentExternalFileId_idx"
  ON "MediaAsset"("businessId", "parentExternalFileId");

CREATE INDEX "MediaAsset_externalLocalPath_idx"
  ON "MediaAsset"("externalLocalPath")
  WHERE "externalLocalPath" IS NOT NULL;
