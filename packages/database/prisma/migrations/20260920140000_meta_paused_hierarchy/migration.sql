-- CreateEnum
CREATE TYPE "MetaPublishStatus" AS ENUM ('DRAFT', 'PUBLISHING', 'PAUSED', 'FAILED');

-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN "metaAdSetId" TEXT,
ADD COLUMN "metaPublishFingerprint" TEXT,
ADD COLUMN "metaPublishStatus" "MetaPublishStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "metaPublishAttemptId" TEXT,
ADD COLUMN "metaPublishError" TEXT,
ADD COLUMN "metaPublishStartedAt" TIMESTAMP(3),
ADD COLUMN "metaPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CampaignCreative"
ADD COLUMN "metaCreativeId" TEXT,
ADD COLUMN "metaAdId" TEXT,
ADD COLUMN "metaPublishFingerprint" TEXT,
ADD COLUMN "metaPublishedAt" TIMESTAMP(3);

-- Align future account records with the existing Blondor ad account.
ALTER TABLE "MetaAdAccount" ALTER COLUMN "timezone" SET DEFAULT 'Pacific/Easter';

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_businessId_metaAdSetId_key" ON "Campaign"("businessId", "metaAdSetId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCreative_businessId_metaCreativeId_key" ON "CampaignCreative"("businessId", "metaCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCreative_businessId_metaAdId_key" ON "CampaignCreative"("businessId", "metaAdId");
