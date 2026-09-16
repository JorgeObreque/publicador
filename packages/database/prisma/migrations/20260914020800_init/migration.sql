-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PAUSED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MetaEntityType" AS ENUM ('CAMPAIGN', 'ADSET', 'AD', 'CREATIVE');

-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('CLICK', 'VISIT', 'WHATSAPP_OPEN', 'FORM_SUBMIT');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'DEPOSIT_CONFIRMED', 'ATTENDED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "duration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "pausedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "metaCampaignId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "callToAction" TEXT NOT NULL,
    "imageUrl" TEXT,
    "metaCreativeId" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCreative" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "attributionCode" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "metaAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "timezone" TEXT NOT NULL DEFAULT 'America/Santiago',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaEntityMapping" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "entityType" "MetaEntityType" NOT NULL,
    "metaId" TEXT NOT NULL,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaEntityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMetricDaily" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignCreativeId" TEXT,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "eventType" "TrackingEventType" NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "utmCampaignId" TEXT,
    "utmCampaignCreativeId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "campaignCreativeId" TEXT,
    "serviceId" TEXT,
    "attributionCode" TEXT,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "contactRef" TEXT,
    "notes" TEXT,
    "externalAppointmentId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "primaryKpi" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "campaignCreativeId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "experimentId" TEXT,
    "category" TEXT NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationRecommendation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "decisionLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLogEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "outcome" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAppointment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "externalAppointmentId" BIGINT NOT NULL,
    "externalCustomerId" BIGINT,
    "providerId" INTEGER,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "appointmentStatus" TEXT NOT NULL,
    "notesRaw" TEXT,
    "attributionCode" TEXT,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "campaignCreativeId" TEXT,
    "depositConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DECIMAL(12,2),
    "depositCurrency" TEXT,
    "outcome" "ConversionStatus",
    "finalRevenue" DECIMAL(12,2),
    "finalRevenueCurrency" TEXT,
    "rawPayload" JSONB NOT NULL DEFAULT '{}',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EasyAppointmentsServiceMap" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "externalServiceId" INTEGER NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EasyAppointmentsServiceMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_name_idx" ON "Business"("name");

-- CreateIndex
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_businessId_name_key" ON "Service"("businessId", "name");

-- CreateIndex
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");

-- CreateIndex
CREATE INDEX "Campaign_businessId_status_idx" ON "Campaign"("businessId", "status");

-- CreateIndex
CREATE INDEX "Campaign_serviceId_idx" ON "Campaign"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_businessId_metaCampaignId_key" ON "Campaign"("businessId", "metaCampaignId");

-- CreateIndex
CREATE INDEX "Creative_businessId_idx" ON "Creative"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_businessId_metaCreativeId_key" ON "Creative"("businessId", "metaCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCreative_attributionCode_key" ON "CampaignCreative"("attributionCode");

-- CreateIndex
CREATE INDEX "CampaignCreative_businessId_idx" ON "CampaignCreative"("businessId");

-- CreateIndex
CREATE INDEX "CampaignCreative_creativeId_idx" ON "CampaignCreative"("creativeId");

-- CreateIndex
CREATE INDEX "CampaignCreative_businessId_campaignId_idx" ON "CampaignCreative"("businessId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCreative_campaignId_creativeId_key" ON "CampaignCreative"("campaignId", "creativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_businessId_metaAccountId_key" ON "MetaAdAccount"("businessId", "metaAccountId");

-- CreateIndex
CREATE INDEX "MetaEntityMapping_businessId_idx" ON "MetaEntityMapping"("businessId");

-- CreateIndex
CREATE INDEX "MetaEntityMapping_adAccountId_idx" ON "MetaEntityMapping"("adAccountId");

-- CreateIndex
CREATE INDEX "MetaEntityMapping_campaignId_idx" ON "MetaEntityMapping"("campaignId");

-- CreateIndex
CREATE INDEX "MetaEntityMapping_creativeId_idx" ON "MetaEntityMapping"("creativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaEntityMapping_entityType_metaId_key" ON "MetaEntityMapping"("entityType", "metaId");

-- CreateIndex
CREATE INDEX "AdMetricDaily_businessId_date_idx" ON "AdMetricDaily"("businessId", "date");

-- CreateIndex
CREATE INDEX "AdMetricDaily_campaignCreativeId_idx" ON "AdMetricDaily"("campaignCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetricDaily_campaignId_campaignCreativeId_date_key" ON "AdMetricDaily"("campaignId", "campaignCreativeId", "date");

-- CreateIndex
CREATE INDEX "TrackingEvent_businessId_occurredAt_idx" ON "TrackingEvent"("businessId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEvent_businessId_eventType_eventId_key" ON "TrackingEvent"("businessId", "eventType", "eventId");

-- CreateIndex
CREATE INDEX "Conversion_businessId_occurredAt_idx" ON "Conversion"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "Conversion_businessId_status_idx" ON "Conversion"("businessId", "status");

-- CreateIndex
CREATE INDEX "Conversion_campaignId_idx" ON "Conversion"("campaignId");

-- CreateIndex
CREATE INDEX "Conversion_creativeId_idx" ON "Conversion"("creativeId");

-- CreateIndex
CREATE INDEX "Conversion_campaignCreativeId_idx" ON "Conversion"("campaignCreativeId");

-- CreateIndex
CREATE INDEX "Conversion_serviceId_idx" ON "Conversion"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_businessId_externalAppointmentId_key" ON "Conversion"("businessId", "externalAppointmentId");

-- CreateIndex
CREATE INDEX "Experiment_businessId_idx" ON "Experiment"("businessId");

-- CreateIndex
CREATE INDEX "Experiment_campaignId_idx" ON "Experiment"("campaignId");

-- CreateIndex
CREATE INDEX "ExperimentVariant_campaignCreativeId_idx" ON "ExperimentVariant"("campaignCreativeId");

-- CreateIndex
CREATE INDEX "ExperimentVariant_creativeId_idx" ON "ExperimentVariant"("creativeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentVariant_experimentId_campaignCreativeId_key" ON "ExperimentVariant"("experimentId", "campaignCreativeId");

-- CreateIndex
CREATE INDEX "Insight_businessId_createdAt_idx" ON "Insight"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Insight_experimentId_idx" ON "Insight"("experimentId");

-- CreateIndex
CREATE INDEX "OptimizationRecommendation_businessId_status_idx" ON "OptimizationRecommendation"("businessId", "status");

-- CreateIndex
CREATE INDEX "OptimizationRecommendation_decisionLogId_idx" ON "OptimizationRecommendation"("decisionLogId");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_businessId_decidedAt_idx" ON "DecisionLogEntry"("businessId", "decidedAt");

-- CreateIndex
CREATE INDEX "ExternalAppointment_businessId_scheduledStart_idx" ON "ExternalAppointment"("businessId", "scheduledStart");

-- CreateIndex
CREATE INDEX "ExternalAppointment_attributionCode_idx" ON "ExternalAppointment"("attributionCode");

-- CreateIndex
CREATE INDEX "ExternalAppointment_serviceId_idx" ON "ExternalAppointment"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAppointment_businessId_externalAppointmentId_key" ON "ExternalAppointment"("businessId", "externalAppointmentId");

-- CreateIndex
CREATE INDEX "EasyAppointmentsServiceMap_serviceId_idx" ON "EasyAppointmentsServiceMap"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "EasyAppointmentsServiceMap_businessId_externalServiceId_key" ON "EasyAppointmentsServiceMap"("businessId", "externalServiceId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdAccount" ADD CONSTRAINT "MetaAdAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEntityMapping" ADD CONSTRAINT "MetaEntityMapping_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEntityMapping" ADD CONSTRAINT "MetaEntityMapping_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "MetaAdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEntityMapping" ADD CONSTRAINT "MetaEntityMapping_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEntityMapping" ADD CONSTRAINT "MetaEntityMapping_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_campaignCreativeId_fkey" FOREIGN KEY ("campaignCreativeId") REFERENCES "CampaignCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_campaignCreativeId_fkey" FOREIGN KEY ("campaignCreativeId") REFERENCES "CampaignCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_externalAppointmentId_fkey" FOREIGN KEY ("externalAppointmentId") REFERENCES "ExternalAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_campaignCreativeId_fkey" FOREIGN KEY ("campaignCreativeId") REFERENCES "CampaignCreative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationRecommendation" ADD CONSTRAINT "OptimizationRecommendation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationRecommendation" ADD CONSTRAINT "OptimizationRecommendation_decisionLogId_fkey" FOREIGN KEY ("decisionLogId") REFERENCES "DecisionLogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLogEntry" ADD CONSTRAINT "DecisionLogEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAppointment" ADD CONSTRAINT "ExternalAppointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAppointment" ADD CONSTRAINT "ExternalAppointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasyAppointmentsServiceMap" ADD CONSTRAINT "EasyAppointmentsServiceMap_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EasyAppointmentsServiceMap" ADD CONSTRAINT "EasyAppointmentsServiceMap_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
