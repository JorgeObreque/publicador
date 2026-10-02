CREATE TABLE "MetaRemoteMetricDaily" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "metaCampaignId" TEXT NOT NULL,
  "metaAdId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "leads" INTEGER NOT NULL DEFAULT 0,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaRemoteMetricDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaRemoteMetricDaily_businessId_metaCampaignId_metaAdId_da_key"
  ON "MetaRemoteMetricDaily"("businessId", "metaCampaignId", "metaAdId", "date");
CREATE INDEX "MetaRemoteMetricDaily_businessId_idx" ON "MetaRemoteMetricDaily"("businessId");
CREATE INDEX "MetaRemoteMetricDaily_businessId_metaCampaignId_idx"
  ON "MetaRemoteMetricDaily"("businessId", "metaCampaignId");
CREATE INDEX "MetaRemoteMetricDaily_businessId_date_idx"
  ON "MetaRemoteMetricDaily"("businessId", "date");
ALTER TABLE "MetaRemoteMetricDaily"
  ADD CONSTRAINT "MetaRemoteMetricDaily_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
