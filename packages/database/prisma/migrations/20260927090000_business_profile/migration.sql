-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "addressLine" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "publicEmail" TEXT,
    "googleMapsUrl" TEXT,
    "brandVoiceKeywords" TEXT[],
    "wordsToAvoid" TEXT[],
    "preferredEmojiSemantics" TEXT[],
    "primaryCustomerProfile" TEXT,
    "commonObjections" TEXT[],
    "qualifyingQuestions" TEXT[],
    "weeklyServiceCapacity" INTEGER,
    "monthlyRevenueTarget" DECIMAL(12,2),
    "monthlyAcquisitionGoal" INTEGER,
    "costPerAcquisitionCap" DECIMAL(12,2),
    "tagline" TEXT,
    "differentiators" TEXT[],
    "profileCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_businessId_key" ON "BusinessProfile"("businessId");

-- CreateIndex
CREATE INDEX "BusinessProfile_businessId_idx" ON "BusinessProfile"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;