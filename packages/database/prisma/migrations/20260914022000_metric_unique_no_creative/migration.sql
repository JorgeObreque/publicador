-- Enforce single campaign metric per day when no creative is attached.

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_campaign_metric_per_day_no_creative"
ON "AdMetricDaily" ("campaignId", "date")
WHERE "campaignCreativeId" IS NULL;
