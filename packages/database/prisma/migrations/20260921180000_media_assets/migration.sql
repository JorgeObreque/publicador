-- CreateEnum
CREATE TYPE "MediaAssetSource" AS ENUM ('GOOGLE_DRIVE', 'URL');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('READY', 'MISSING', 'ARCHIVED');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "source" "MediaAssetSource" NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "externalFileId" TEXT NOT NULL,
    "externalFolderId" TEXT,
    "externalFolderKey" TEXT,
    "externalLink" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'READY',
    "archivedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_businessId_source_externalFileId_key" ON "MediaAsset"("businessId", "source", "externalFileId");

-- CreateIndex
CREATE INDEX "MediaAsset_businessId_idx" ON "MediaAsset"("businessId");

-- CreateIndex
CREATE INDEX "MediaAsset_businessId_kind_idx" ON "MediaAsset"("businessId", "kind");

-- CreateIndex
CREATE INDEX "MediaAsset_businessId_status_idx" ON "MediaAsset"("businessId", "status");

-- AlterTable
ALTER TABLE "Creative" ADD COLUMN "mediaAssetId" TEXT;

-- CreateIndex
CREATE INDEX "Creative_mediaAssetId_idx" ON "Creative"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
