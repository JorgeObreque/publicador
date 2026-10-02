-- Mirror de campañas remotas de Meta que no fueron creadas por Publicador.
CREATE TABLE "MetaRemoteCampaign" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "metaCampaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "effectiveStatus" TEXT,
  "objective" TEXT,
  "dailyBudget" TEXT,
  "lifetimeBudget" TEXT,
  "startTime" TIMESTAMP(3),
  "stopTime" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MetaRemoteCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaRemoteCampaign_businessId_metaCampaignId_key"
  ON "MetaRemoteCampaign"("businessId", "metaCampaignId");
CREATE INDEX "MetaRemoteCampaign_businessId_idx" ON "MetaRemoteCampaign"("businessId");
CREATE INDEX "MetaRemoteCampaign_businessId_status_idx" ON "MetaRemoteCampaign"("businessId", "status");

ALTER TABLE "MetaRemoteCampaign"
  ADD CONSTRAINT "MetaRemoteCampaign_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
