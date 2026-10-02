-- CreateEnum
CREATE TYPE "CommercialDiagnosisStatus" AS ENUM ('IN_PROGRESS', 'READY', 'ACCEPTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommercialDataSource" AS ENUM (
    'USER_PROFILE',
    'USER_CURRENT_SITUATION',
    'AI_INFERENCE',
    'SYSTEM_CALCULATION',
    'AI_RECOMMENDATION',
    'CAMPAIGN_OBSERVED_DATA'
);

-- CreateTable
CREATE TABLE "CommercialDiagnosis" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "CommercialDiagnosisStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentSituation" TEXT NOT NULL,
    "serviceId" TEXT,
    "situation" TEXT,
    "opportunity" TEXT,
    "primaryGoal" TEXT,
    "primaryConversion" TEXT,
    "recommendedTitle" TEXT,
    "recommendedWeeklyAdd" INTEGER,
    "availableCapacity" INTEGER,
    "businessObjective" TEXT,
    "offer" TEXT,
    "primaryKpi" TEXT,
    "idealCustomerProfile" TEXT,
    "qualifyingQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "stopIf" TEXT,
    "scaleIf" TEXT,
    "initialDailyBudgetCLP" DECIMAL(12,2),
    "initialLifetimeBudgetCLP" DECIMAL(12,2),
    "initialDurationDays" INTEGER,
    "initialCpaTargetCLP" DECIMAL(12,2),
    "initialCpaCapCLP" DECIMAL(12,2),
    "progressionSteps" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "campaignBriefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticAnswer" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT,
    "wasClarification" BOOLEAN NOT NULL DEFAULT false,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosticAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialDiagnosis_campaignBriefId_key" ON "CommercialDiagnosis"("campaignBriefId");

-- CreateIndex
CREATE INDEX "CommercialDiagnosis_businessId_idx" ON "CommercialDiagnosis"("businessId");

-- CreateIndex
CREATE INDEX "CommercialDiagnosis_businessId_status_idx" ON "CommercialDiagnosis"("businessId", "status");

-- CreateIndex
CREATE INDEX "DiagnosticAnswer_diagnosisId_idx" ON "DiagnosticAnswer"("diagnosisId");

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "campaignBriefId" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_campaignBriefId_idx" ON "Campaign"("campaignBriefId");

-- AddForeignKey
ALTER TABLE "CommercialDiagnosis" ADD CONSTRAINT "CommercialDiagnosis_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialDiagnosis" ADD CONSTRAINT "CommercialDiagnosis_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialDiagnosis" ADD CONSTRAINT "CommercialDiagnosis_campaignBriefId_fkey" FOREIGN KEY ("campaignBriefId") REFERENCES "CampaignBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "CommercialDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_campaignBriefId_fkey" FOREIGN KEY ("campaignBriefId") REFERENCES "CampaignBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
