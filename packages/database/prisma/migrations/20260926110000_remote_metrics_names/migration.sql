ALTER TABLE "MetaRemoteMetricDaily"
  ADD COLUMN "metaAdSetId" TEXT,
  ADD COLUMN "adSetName" TEXT,
  ADD COLUMN "adName" TEXT;

CREATE INDEX "MetaRemoteMetricDaily_businessId_metaCampaignId_metaAdSetId_idx"
  ON "MetaRemoteMetricDaily"("businessId", "metaCampaignId", "metaAdSetId");
