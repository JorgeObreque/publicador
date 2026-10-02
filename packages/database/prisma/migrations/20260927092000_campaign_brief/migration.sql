-- CreateEnum
CREATE TYPE "CampaignBriefStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CampaignBrief" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CampaignBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "businessObjective" TEXT NOT NULL,
    "offer" TEXT NOT NULL,
    "primaryKpi" TEXT NOT NULL,
    "idealCustomerProfile" TEXT,
    "qualifyingQuestions" TEXT[],
    "monthlyAcquisitionGoal" INTEGER,
    "costPerAcquisitionCap" DECIMAL(12,2),
    "lifetimeBudgetCap" DECIMAL(12,2),
    "dailyBudgetCap" DECIMAL(12,2),
    "plannedDurationDays" INTEGER,
    "constraints" TEXT[],
    "stopIf" TEXT,
    "scaleIf" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignBrief_businessId_idx" ON "CampaignBrief"("businessId");

-- CreateIndex
CREATE INDEX "CampaignBrief_businessId_status_idx" ON "CampaignBrief"("businessId", "status");

-- AddForeignKey
ALTER TABLE "CampaignBrief" ADD CONSTRAINT "CampaignBrief_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBrief" ADD CONSTRAINT "CampaignBrief_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
