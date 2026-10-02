-- AlterTable
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "recommendedStartDate" DATE;
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "recommendedEndDate" DATE;
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "recommendedWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "budgetExplanation" TEXT;
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "scheduleExplanation" TEXT;
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "assumptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CommercialDiagnosis" ADD COLUMN "goalAssessment" JSONB;
